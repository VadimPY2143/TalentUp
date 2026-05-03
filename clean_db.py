import asyncio
import asyncpg

async def clean_all():
    conn = await asyncpg.connect('postgresql://postgres:01L02d2008@localhost/talentupdb')
    
    # Drop all tables
    tables = await conn.fetch('''
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ''')
    
    for row in tables:
        await conn.execute(f'DROP TABLE IF EXISTS "{row[0]}" CASCADE')
        print(f'Dropped table: {row[0]}')
    
    # Drop all types
    types = await conn.fetch('''
        SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ''')
    
    for row in types:
        await conn.execute(f'DROP TYPE IF EXISTS "{row[0]}" CASCADE')
        print(f'Dropped type: {row[0]}')
    
    await conn.close()
    print('All cleared!')

asyncio.run(clean_all())
