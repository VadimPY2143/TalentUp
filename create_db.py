import asyncio
import sys
sys.path.insert(0, 'backend')

from database import engine, metadata

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(metadata.drop_all)
        await conn.run_sync(metadata.create_all)
    print("Tables created successfully!")
    await engine.dispose()

asyncio.run(create_tables())
