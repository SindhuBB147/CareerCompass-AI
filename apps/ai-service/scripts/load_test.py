"""Lightweight concurrency benchmark for the RAG query endpoint.

Not a substitute for a dedicated load-testing platform (Locust, k6) — this
is a pragmatic script for sanity-checking latency under light concurrent
load during development. Run with the ai-service already running:

    python scripts/load_test.py --url http://localhost:8000 --requests 50 --concurrency 10
"""
import argparse
import asyncio
import statistics
import time

import httpx

QUERIES = [
    "What is the KCET closing rank for CSE at RVCE?",
    "Which colleges are safest for my rank?",
    "What scholarships am I eligible for?",
    "What is the total cost of studying at RVCE including hostel?",
    "What skills should I learn for a CSE placement?",
]


async def _one_request(client: httpx.AsyncClient, url: str, token: str, query: str) -> float:
    start = time.perf_counter()
    await client.post(
        f"{url}/rag/query",
        headers={"X-Internal-Token": token} if token else {},
        json={
            "query": query, "student_context": {}, "structured_context": [],
            "conversation_history": [],
        },
        timeout=30.0,
    )
    return (time.perf_counter() - start) * 1000


async def run(url: str, token: str, total_requests: int, concurrency: int) -> None:
    semaphore = asyncio.Semaphore(concurrency)
    latencies: list[float] = []

    async def bounded(client: httpx.AsyncClient, query: str) -> None:
        async with semaphore:
            latencies.append(await _one_request(client, url, token, query))

    async with httpx.AsyncClient() as client:
        tasks = [bounded(client, QUERIES[i % len(QUERIES)]) for i in range(total_requests)]
        start = time.perf_counter()
        await asyncio.gather(*tasks)
        total_time = time.perf_counter() - start

    latencies.sort()
    p50 = latencies[int(len(latencies) * 0.50)]
    p95 = latencies[min(int(len(latencies) * 0.95), len(latencies) - 1)]
    p99 = latencies[min(int(len(latencies) * 0.99), len(latencies) - 1)]

    print(f"Requests: {total_requests}, concurrency: {concurrency}")
    print(f"Total time: {total_time:.2f}s, throughput: {total_requests / total_time:.1f} req/s")
    print(f"Latency (ms) — min: {latencies[0]:.0f}, p50: {p50:.0f}, p95: {p95:.0f}, p99: {p99:.0f}, max: {latencies[-1]:.0f}")
    print(f"Mean: {statistics.mean(latencies):.0f}ms, stdev: {statistics.pstdev(latencies):.0f}ms")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--token", default="dev-shared-secret-change-in-production")
    parser.add_argument("--requests", type=int, default=50)
    parser.add_argument("--concurrency", type=int, default=10)
    args = parser.parse_args()

    asyncio.run(run(args.url, args.token, args.requests, args.concurrency))
