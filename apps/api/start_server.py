#!/usr/bin/env python3
"""
FastAPI Server Startup Script

This script starts the FastAPI server with proper configuration and environment setup.
It includes helpful logging and validation to ensure all required services are available.
"""

import os
import sys
import asyncio
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

def validate_environment():
    """Validate that all required environment variables are set"""
    load_dotenv(Path(__file__).parent / ".env.local")
    
    required_vars = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'NEO4J_PASSWORD'
    ]
    
    optional_vars = [
        'NEO4J_URI',
        'NEO4J_USER',
        'FASTAPI_HOST',
        'FASTAPI_PORT'
    ]
    
    print("🔍 Validating environment configuration...")
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
        else:
            print(f"  ✅ {var}: {'*' * min(len(os.getenv(var, '')), 20)}...")
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        print("Please check your .env.local file")
        return False
    
    # Show optional vars
    for var in optional_vars:
        value = os.getenv(var)
        if value:
            print(f"  ✅ {var}: {value}")
        else:
            print(f"  ⚪ {var}: (using default)")
    
    # Check for Google Drive credentials
    credentials_path = Path(__file__).parent.parent / "credentials.json"
    token_path = Path(__file__).parent.parent / "token.json"
    
    if credentials_path.exists():
        print(f"  ✅ Google Drive credentials: {credentials_path}")
    else:
        print(f"  ⚠️  Google Drive credentials not found: {credentials_path}")
    
    if token_path.exists():
        print(f"  ✅ Google Drive token: {token_path}")
    else:
        print(f"  ⚠️  Google Drive token not found: {token_path}")
    
    print("✅ Environment validation completed")
    return True

def main():
    """Main function to start the FastAPI server"""
    print("🚀 Starting Mentorfy FastAPI Server...")
    
    # Validate environment first
    if not validate_environment():
        sys.exit(1)
    
    # Get server configuration
    host = os.getenv('FASTAPI_HOST', '0.0.0.0')
    port = int(os.getenv('FASTAPI_PORT', '8000'))
    log_level = os.getenv('LOG_LEVEL', 'info').lower()
    
    print(f"📡 Server will run on: http://{host}:{port}")
    print(f"📖 API Documentation: http://{host}:{port}/docs")
    print(f"🏥 Health Check: http://{host}:{port}/health")
    print()
    
    # Start the server
    try:
        uvicorn.run(
            "mentorfy.api.app:app",
            host=host,
            port=port,
            log_level=log_level,
            reload=True,  # Enable auto-reload for development
            reload_dirs=[str(Path(__file__).parent / "mentorfy")],  # Watch mentorfy package for changes
            access_log=True,  # Enable HTTP request logging
        )
    except KeyboardInterrupt:
        print("\n🛑 Server shutdown requested")
    except Exception as e:
        print(f"❌ Server startup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()