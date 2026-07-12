import "dotenv/config";
import { buildServer } from "./interfaces/http/server";

const app = buildServer();
const port = Number(process.env.PORT) || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
