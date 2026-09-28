# ==============================================================================
# Cyberpunk TCG - Production Web Container
# Lightweight, secure, multi-distro compatible (Fedora, Ubuntu, Debian, Alpine)
# ==============================================================================
FROM python:3.11-slim

# Create dedicated unprivileged user for security
RUN groupadd -g 10001 cptcg && \
    useradd -u 10001 -g cptcg -m -s /bin/bash cptcg

WORKDIR /app

# Copy application files
COPY --chown=cptcg:cptcg . /app

# Pre-compile the monolith bundle during image build
RUN python3 scripts/build_monolith.py

# Switch to non-root user
USER cptcg

# Default port
ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

# Launch production server
CMD ["python3", "scripts/container/server_prod.py"]
