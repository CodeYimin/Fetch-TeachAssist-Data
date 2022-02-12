import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import routes from "./routes";

dotenv.config();

const PORT = process.env.PORT || 3002;

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.use("/api", routes);

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
