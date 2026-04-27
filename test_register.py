import httpx
import asyncio

async def test():
    url = "http://localhost:8000/api/auth/register"
    payload = {
        "email": f"testuser_{asyncio.get_event_loop().time()}@example.com",
        "password": "testpassword123",
        "full_name": "Test User",
        "role": "both"
    }
    async with httpx.AsyncClient() as client:
        # First attempt
        resp = await client.post(url, json=payload)
        print(f"Attempt 1 Status: {resp.status_code}")
        
        # Second attempt with same email
        resp = await client.post(url, json=payload)
        print(f"Attempt 2 Status: {resp.status_code}")
        print(f"Attempt 2 Response: {resp.json()}")

if __name__ == "__main__":
    asyncio.run(test())
