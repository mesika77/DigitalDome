from fastapi.testclient import TestClient

from main import AGENT_HEARTBEATS, app


client = TestClient(app)


def setup_function():
    AGENT_HEARTBEATS.clear()


def test_dataflow_status_reports_real_core_nodes():
    response = client.get("/api/dataflows/status")

    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] in {"healthy", "degraded", "down"}
    assert data["generated_at"]
    assert data["summary"]["total_memes"] >= 0
    assert data["summary"]["total_batches"] >= 0
    node_ids = {node["id"] for node in data["nodes"]}
    assert {"database", "storage", "inject-api", "ai-analysis", "agent-4chan"}.issubset(node_ids)
    assert any(edge["from"] == "agent-4chan" and edge["to"] == "inject-api" for edge in data["edges"])
    assert any(issue["component"] == "agent-4chan" for issue in data["issues"])


def test_agent_heartbeat_updates_dataflow_status():
    heartbeat = {
        "agent_id": "4chan-pol",
        "agent_type": "4chan",
        "source": "4chan",
        "community": "/pol/",
        "status": "healthy",
        "message": "scan complete",
        "metrics": {"threads_changed": 3, "injected": 1},
    }

    post_response = client.post("/api/agents/heartbeat", json=heartbeat)
    assert post_response.status_code == 200
    assert post_response.json()["ok"] is True

    status_response = client.get("/api/dataflows/status")
    data = status_response.json()
    agent = next(agent for agent in data["agents"] if agent["agent_id"] == "4chan-pol")
    assert agent["status"] == "healthy"
    assert agent["metrics"]["injected"] == 1
    agent_node = next(node for node in data["nodes"] if node["id"] == "agent-4chan")
    assert agent_node["status"] == "healthy"
