import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import dotenv from "dotenv"
import { TokenRoutes } from "./routes"
dotenv.config()
import { validateConfig } from "./config"


const port = Number(process.env.PORT) || 3001
class App {
    public app: express.Application

    constructor() {
        this.validateEnvVars();
        this.app = express();
        this.initializeMiddleware();
        this.initlizeRoutes();
    }
    validateEnvVars() {
        validateConfig();
    }

    initializeMiddleware() {
        this.app.use(cors())
        this.app.use(express.json())
        this.app.use(express.urlencoded({ extended: false }))
        this.app.use(cookieParser())
    }
    initlizeRoutes() {
        this.app.get('/health-check', (req, res) => {
            console.log("Server running ")
            res.send('Server is up and running fine !')
        })
        this.app.use('/api', TokenRoutes);
    }
    listen(PORT: number) {
        this.app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })
    }
}


const app = new App();
app.listen(port)