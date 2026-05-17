import os
from dotenv import load_dotenv
from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB
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

engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=True,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
)
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
    Column('username', String(50), unique=False, nullable=False),
    Column('email', String(255), unique=True, nullable=False),
    Column('password', String(255), nullable=False),
    Column('credits', Integer, nullable=False, default=50, server_default='0'),
    Column(
        'role',
        Enum('employer', 'worker', name='user_role'),
        nullable=False,
        server_default='worker',
    ),
    CheckConstraint('credits >= 0', name='ck_users_credits_non_negative'),
)

payment_status_enum = Enum(
    'pending',
    'success',
    'failed',
    'expired',
    name='payment_order_status',
)

credit_transaction_type_enum = Enum(
    'purchase',
    'debit',
    'refund',
    'manual_adjustment',
    name='credit_transaction_type',
)

credit_packages_table = Table(
    'credit_packages',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('code', String(64), unique=True, nullable=False),
    Column('name', String(128), nullable=False),
    Column('credits', Integer, nullable=False),
    Column('price_uah', Integer, nullable=False),
    Column('is_active', Boolean, nullable=False, server_default='true'),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        'updated_at',
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
    CheckConstraint('credits > 0', name='ck_credit_packages_credits_positive'),
    CheckConstraint('price_uah > 0', name='ck_credit_packages_price_positive'),
)

payment_orders_table = Table(
    'payment_orders',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    Column('package_id', Integer, ForeignKey('credit_packages.id', ondelete='RESTRICT'), nullable=False),
    Column('provider', String(32), nullable=False, server_default='wayforpay'),
    Column('provider_order_id', String(128), unique=True, nullable=False),
    Column('amount_uah', Integer, nullable=False),
    Column('status', payment_status_enum, nullable=False, server_default='pending'),
    Column('idempotency_key', String(128), unique=True, nullable=False),
    Column('provider_payload', JSON),
    Column('paid_at', DateTime(timezone=True)),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        'updated_at',
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
    CheckConstraint('amount_uah > 0', name='ck_payment_orders_amount_positive'),
    Index('ix_payment_orders_user_id', 'user_id'),
    Index('ix_payment_orders_status', 'status'),
)

credit_transactions_table = Table(
    'credit_transactions',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    Column('type', credit_transaction_type_enum, nullable=False),
    Column('amount', Integer, nullable=False),
    Column('balance_after', Integer, nullable=False),
    Column('feature_code', String(64)),
    Column('reference_type', String(64)),
    Column('reference_id', String(128)),
    Column('idempotency_key', String(128), unique=True, nullable=False),
    Column('meta', JSON),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False),
    CheckConstraint('balance_after >= 0', name='ck_credit_transactions_balance_non_negative'),
    Index('ix_credit_transactions_user_id_created_at', 'user_id', 'created_at'),
    Index('ix_credit_transactions_feature_code', 'feature_code'),
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

languages_table = Table(
    "languages",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(100), unique=True, nullable=False),
    Column("popularity_rank", Integer, nullable=False),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Index("ix_languages_popularity_rank", "popularity_rank"),
)

user_languages_table = Table(
    "user_languages",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("language_id", Integer, ForeignKey("languages.id", ondelete="CASCADE"), nullable=False),
    Column("proficiency_level", String(10), nullable=False),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    UniqueConstraint("user_id", "language_id", name="uq_user_languages_user_language"),
    Index("ix_user_languages_user_id", "user_id"),
)

user_links_table = Table(
    "user_links",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("title", String(255), nullable=False),
    Column("url", String(500), nullable=False),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    UniqueConstraint("user_id", "url", name="uq_user_links_user_url"),
    Index("ix_user_links_user_id", "user_id"),
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

vacancy_subscriptions_table = Table(
    "vacancy_subscriptions",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("email", String(255), nullable=False),
    Column("search_text", String(255), nullable=False),
    Column("filters", JSON, nullable=False),
    Column("is_active", Boolean, nullable=False, server_default="true"),
    Column("next_run_at", DateTime(timezone=True), nullable=False),
    Column("last_processed_at", DateTime(timezone=True)),
    Column("last_sent_at", DateTime(timezone=True)),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        "updated_at",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
    Index("ix_vacancy_subscriptions_user_id", "user_id"),
    Index("ix_vacancy_subscriptions_due", "is_active", "next_run_at"),
)

vacancy_subscription_deliveries_table = Table(
    "vacancy_subscription_deliveries",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "subscription_id",
        Integer,
        ForeignKey("vacancy_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("period_start", DateTime(timezone=True), nullable=False),
    Column("period_end", DateTime(timezone=True), nullable=False),
    Column("status", String(20), nullable=False, server_default="pending"),
    Column("vacancies_count", Integer, nullable=False, server_default="0"),
    Column("error", Text),
    Column("sent_at", DateTime(timezone=True)),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    UniqueConstraint(
        "subscription_id",
        "period_start",
        "period_end",
        name="uq_vacancy_subscription_deliveries_period",
    ),
    Index("ix_vacancy_subscription_deliveries_subscription_id", "subscription_id"),
    Index("ix_vacancy_subscription_deliveries_status", "status"),
)


saved_resumes_table = Table(
    'saved_resumes',
    metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('company_id', Integer, ForeignKey('companies.id'), nullable=False),
    Column('saved_resume_id', Integer, ForeignKey('resumes.id'), nullable=False),
)

saved_vacancies_table = Table(
    "saved_vacancies",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("vacancy_id", Integer, ForeignKey("vacancies.id", ondelete="CASCADE"), nullable=False),
    Column("note", Text),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        "updated_at",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
    Index("uq_saved_vacancies_user_vacancy", "user_id", "vacancy_id", unique=True),
    Index("ix_saved_vacancies_user_id", "user_id"),
    Index("ix_saved_vacancies_vacancy_id", "vacancy_id"),
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
    Index("uq_job_applications_vacancy_resume", "vacancy_id", "resume_id", unique=True),
    Index("ix_job_applications_user_id", "user_id"),
    Index("ix_job_applications_vacancy_id", "vacancy_id"),
    Index("ix_job_applications_resume_id", "resume_id"),
)

candidate_match_ai_cache_table = Table(
    "candidate_match_ai_cache",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("vacancy_id", Integer, ForeignKey("vacancies.id", ondelete="CASCADE"), nullable=False),
    Column("application_id", Integer, ForeignKey("job_applications.id", ondelete="CASCADE"), nullable=False),
    Column("vacancy_signature", String(64), nullable=False),
    Column("application_signature", String(64), nullable=False),
    Column("score_total", Integer, nullable=False),
    Column("verdict", String(32), nullable=False),
    Column("summary", Text, nullable=False),
    Column("model_name", String(128), nullable=False),
    Column("analyzed_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column(
        "updated_at",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
    CheckConstraint("score_total >= 0 AND score_total <= 100", name="ck_candidate_match_ai_cache_score_total"),
    UniqueConstraint(
        "vacancy_id",
        "application_id",
        "vacancy_signature",
        "application_signature",
        name="uq_candidate_match_ai_cache_signature",
    ),
    Index("ix_candidate_match_ai_cache_vacancy_application", "vacancy_id", "application_id"),
    Index("ix_candidate_match_ai_cache_analyzed_at", "analyzed_at"),
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
    Index(
        "ix_analytics_events_type_target_user_occurred",
        "event_type",
        "target_user_id",
        "occurred_at",
    ),
    Index(
        "ix_analytics_events_type_target_resume_occurred",
        "event_type",
        "target_resume_id",
        "occurred_at",
    ),
    Index(
        "ix_analytics_events_actor_type_occurred",
        "actor_user_id",
        "event_type",
        "occurred_at",
    ),
)

notifications_table = Table(
    "notifications",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("type", String(100), nullable=False),
    Column("title", String(255), nullable=False),
    Column("body", Text),
    Column("entity_type", String(100)),
    Column("entity_id", Integer),
    Column("payload_json", JSONB),
    Column("is_read", Boolean, nullable=False, server_default="false"),
    Column("read_at", DateTime(timezone=True)),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
)

Index(
    "ix_notifications_user_is_read_created_at_desc",
    notifications_table.c.user_id,
    notifications_table.c.is_read,
    notifications_table.c.created_at.desc(),
)
Index(
    "ix_notifications_user_created_at_desc",
    notifications_table.c.user_id,
    notifications_table.c.created_at.desc(),
)




async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
