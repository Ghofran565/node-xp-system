import app from "./app.js";
import dotenv from "dotenv";
import redis from "redis";
import mongoose from "mongoose";
import { log, logger } from './Utilities/logger.js';
import { __dirname } from "./app.js";

// import { scheduleActiveTournaments } from './Controllers/tournamentCn.js'; //!have to wait for the "build server" time

dotenv.config({ path: `${__dirname}/config.env` });

//await scheduleActiveTournaments(); //!have to wait for the "build server" time

const port = process.env.PORT || 3003;
// log(`The set port is ${port}`).debug().white()

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => log("Database is connected and ready to use").info().cyan())
  .catch((err) => log(err).error());

const client = redis.createClient({ url: process.env.REDIS_URL });
client.connect().then(() => log('Redis connected').info().cyan());

app.listen(port, () => log(`Server is running on port ${port} :]`).info().green());
