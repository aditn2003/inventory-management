import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.middleware.logging import LoggingMiddleware
from app.middleware.error_handler import global_exception_handler

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if settings.seed_on_startup:
        from app.seed import run_seed
        await run_seed()

    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(20),
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if settings.environment == "development"
            else structlog.processors.JSONRenderer(),
        ],
    )

    yield
    # Shutdown (nothing to clean up for now)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Inventory Management System",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Logging middleware
    app.add_middleware(LoggingMiddleware)

    # Global exception handler
    app.add_exception_handler(Exception, global_exception_handler)

    # Health check
    @app.get("/health", tags=["health"])
    async def health() -> dict:
        return {"status": "ok"}

    # Register API routers
    from app.auth.router import router as auth_router
    from app.tenants.router import router as tenants_router
    from app.products.router import router as products_router
    from app.inventory.router import router as inventory_router
    from app.orders.router import router as orders_router
    from app.users.router import router as users_router

    app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(tenants_router, prefix="/api/v1/tenants", tags=["tenants"])
    app.include_router(products_router, prefix="/api/v1/products", tags=["products"])
    app.include_router(inventory_router, prefix="/api/v1/inventory", tags=["inventory"])
    app.include_router(orders_router, prefix="/api/v1/orders", tags=["orders"])
    app.include_router(users_router, prefix="/api/v1/users", tags=["users"])

    return app


app = create_app()
