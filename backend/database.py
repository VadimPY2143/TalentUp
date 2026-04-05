import os
from dotenv import load_dotenv
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
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
    Index,
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

cities_table = Table(
    "cities",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("slug", String(255), unique=True, nullable=False),
    Column("name_uk", String(255), nullable=False),
    Column("name_en", String(255), nullable=False),
    Column("oblast", String(255), nullable=False),
    Column("normalized_name", String(255), nullable=False),
    Column("is_active", Boolean, nullable=False, server_default="true"),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        "updated_at",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
    Index("ix_cities_name_uk", "name_uk"),
    Index("ix_cities_normalized_name", "normalized_name"),
)

city_aliases_table = Table(
    "city_aliases",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("city_id", Integer, ForeignKey("cities.id", ondelete="CASCADE"), nullable=False),
    Column("alias", String(255), nullable=False),
    Column("normalized_alias", String(255), nullable=False),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    UniqueConstraint("city_id", "normalized_alias", name="uq_city_aliases_city_alias"),
    Index("ix_city_aliases_normalized_alias", "normalized_alias"),
)

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

user_profiles_table = Table(
    'users_profile',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column(
        'user_id',
        Integer,
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
    ),
    Column('city', String(100)),
    Column('education', String(255)),
    Column('bio', Text),
    Column('birth_date', Date),
    Column('phone', String(50)),
    Column('languages', ARRAY(String(100))),
    Column('links', ARRAY(String(255))),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        'updated_at',
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
    UniqueConstraint('user_id', name='uq_users_profile_user_id'),
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
    Column('city_id', Integer, ForeignKey('cities.id', ondelete='SET NULL')),
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
    Column('city_id', Integer, ForeignKey('cities.id', ondelete='SET NULL')),
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

APPLICATION_STATUSES = ("applied", "viewed", "chat_started")
application_status_enum = Enum(*APPLICATION_STATUSES, name="application_status")

job_applications_table = Table(
    "job_applications",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
    Column("vacancy_id", Integer, ForeignKey("vacancies.id"), nullable=False),
    Column("resume_id", Integer, ForeignKey("resumes.id"), nullable=True),
    Column("cover_letter", Text),
    Column(
        "status",
        application_status_enum,
        nullable=False,
        server_default="applied",
    ),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        "updated_at",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
    Index("uq_job_applications_user_vacancy", "user_id", "vacancy_id", unique=True),
    Index("ix_job_applications_user_id", "user_id"),
    Index("ix_job_applications_vacancy_id", "vacancy_id"),
    Index("ix_job_applications_resume_id", "resume_id"),
)


application_history_table = Table(
    "application_history",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "application_id",
        Integer,
        ForeignKey("job_applications.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "status",
        application_status_enum,
        nullable=False,
    ),
    Column("comment", Text),
    Column("changed_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Index("ix_application_history_application_id", "application_id"),
)


ANALYTICS_EVENT_TYPES = ("profile_view", "resume_view", "contact_click")
analytics_event_type_enum = Enum(*ANALYTICS_EVENT_TYPES, name="analytics_event_type")

analytics_events_table = Table(
    "analytics_events",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("actor_user_id", Integer, ForeignKey("users.id"), nullable=False),
    Column("target_user_id", Integer, ForeignKey("users.id")),
    Column("target_resume_id", Integer, ForeignKey("resumes.id")),
    Column("event_type", analytics_event_type_enum, nullable=False),
    Column("occurred_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Index("ix_analytics_events_occurred_at", "occurred_at"),
    Index("ix_analytics_events_event_type", "event_type"),
    Index("ix_analytics_events_actor_user_id", "actor_user_id"),
    Index("ix_analytics_events_target_user_id", "target_user_id"),
    Index("ix_analytics_events_target_resume_id", "target_resume_id"),
)




async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
