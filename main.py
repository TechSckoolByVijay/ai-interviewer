from server.backend_server import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.backend_server:app", host="127.0.0.1", port=8000, reload=True)