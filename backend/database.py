import os
from dotenv import load_dotenv
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

load_dotenv()

POSTGRES_USER = os.getenv('POSTGRES_USER')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD')
POSTGRES_HOST = os.getenv('POSTGRES_HOST')
POSTGRES_PORT = os.getenv('POSTGRES_PORT')
POSTGRES_DB = os.getenv('POSTGRES_DB')

DATABASE_URL = (
    f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)

engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=True)
async_session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
)

metadata = MetaData()

users_table = Table(
    'users',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('username', String(50), unique=True, nullable=False),
    Column('email', String(255), unique=True, nullable=False),
    Column('password', String(255), nullable=False),
    Column(
        'role',
        Enum('employer', 'worker', name='user_role'),
        nullable=False,
        server_default='worker',
    ),
)

resumes_table = Table(
    'resumes',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('user_id', Integer, ForeignKey('users.id'), nullable=False),
    Column('title', String(255), nullable=False),
    Column('summary', Text),
    Column('desired_role', String(255)),
    Column('employment_type', ARRAY(String(50))),
    Column('location', String(255)),
    Column('salary_min', Integer),
    Column('salary_max', Integer),
    Column('salary_currency', String(10)),
    Column('years_experience', Integer),
    Column('is_active', Boolean, nullable=False, server_default='true'),
    Column('pdf_file_path', String(500)),
    Column('pdf_original_name', String(255)),
    Column('pdf_size', Integer),
    Column('pdf_uploaded_at', DateTime(timezone=True)),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        'updated_at',
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
)

resume_search_history_table = Table(
    'resume_search_history',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('user_id', Integer, ForeignKey('users.id'), nullable=False),
    Column('search_text', String(255), nullable=False),
)

companies_table = Table(
    'companies',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('user_id', Integer, ForeignKey('users.id'), nullable=False),
    Column('name', String(255), nullable=False),
    Column('legal_name', String(255)),
    Column('description', Text),
    Column('industry', String(100)),
    Column('company_size', String(50)),
    Column('website', String(255)),
    Column('email', String(255)),
    Column('phone', String(50)),
    Column('country', String(100)),
    Column('city', String(100)),
    Column('address', String(255)),
    Column('founded_year', Integer),
    Column('logo_url', String(500)),
    Column('is_verified', Boolean, nullable=False, server_default='false'),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        'updated_at',
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
)

vacancies_table = Table(
    'vacancies',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('company_id', Integer, ForeignKey('companies.id'), nullable=False),
    Column('created_by_user_id', Integer, ForeignKey('users.id'), nullable=False),
    Column('title', String(255), nullable=False),
    Column('description', Text, nullable=False),
    Column('responsibilities', Text),
    Column('requirements', Text),
    Column('is_active', Boolean, nullable=False, server_default='true'),
    Column('employment_type', ARRAY(String(50))),
    Column('location', String(255)),
    Column('salary_min', Integer),
    Column('salary_max', Integer),
    Column('salary_currency', String(10)),
    Column('experience_years_min', Integer),
    Column('experience_years_max', Integer),
    Column('work_format', ARRAY(String(50))),
    Column('expires_at', DateTime(timezone=True)),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        'updated_at',
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
)

vacancies_search_history_table = Table(
    'vacancies_search_history',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('user_id', Integer, ForeignKey('users.id'), nullable=False),
    Column('search_text', String(255), nullable=False),
)

saved_resumes_table = Table(
    'saved_resumes',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('company_id', Integer, ForeignKey('companies.id'), nullable=False),
    Column('saved_resume_id', Integer, ForeignKey('resumes.id'), nullable=False),
)

refresh_tokens_table = Table(
    'refresh_tokens',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('user_id', Integer, ForeignKey('users.id'), nullable=False),
    Column('token_hash', String(64), unique=True, nullable=False),
    Column('expires_at', DateTime(timezone=True), nullable=False),
    Column('revoked_at', DateTime(timezone=True)),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
)

chat_table = Table(
    'chat',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('vacancy_id', Integer, ForeignKey('vacancies.id', ondelete='CASCADE'), nullable=False),
    Column('resume_id', Integer, ForeignKey('resumes.id', ondelete='SET NULL')),
    Column('employer_user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    Column('worker_user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    Column('last_message_at', DateTime(timezone=True)),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        'updated_at',
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
    UniqueConstraint('vacancy_id', 'resume_id', name='uq_chat_vacancy_resume'),
)

messages_table = Table(
    'messages',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('chat_id', Integer, ForeignKey('chat.id', ondelete='CASCADE'), nullable=False),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    Column('message', Text, nullable=False),
    Column('is_read', Boolean, nullable=False, server_default='false'),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
)



async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
