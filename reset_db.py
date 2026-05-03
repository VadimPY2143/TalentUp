import asyncio
import asyncpg

async def reset():
    conn = await asyncpg.connect('postgresql://postgres:01L02d2008@localhost/talentupdb3')
    
    # Drop alembic version table
    await conn.execute('DROP TABLE IF EXISTS alembic_version CASCADE')
    print('Dropped alembic_version')
    
    # Drop all tables
    tables = await conn.fetch('''
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ''')
    
    for row in tables:
        await conn.execute(f'DROP TABLE IF EXISTS "{row[0]}" CASCADE')
        print(f'Dropped: {row[0]}')
    
    # Drop all enums
    enums = await conn.fetch('''
        SELECT typname FROM pg_type WHERE typtype = 'e' 
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ''')
    
    for row in enums:
        await conn.execute(f'DROP TYPE IF EXISTS "{row[0]}" CASCADE')
        print(f'Dropped type: {row[0]}')
    
    await conn.close()
    print('Database cleaned!')

asyncio.run(reset())
