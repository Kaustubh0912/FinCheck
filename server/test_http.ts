import axios from "axios";
import { User, connectDb } from "./src/db";

async function test() {
  await connectDb();
  const user = await User.findOne();
  if (!user) { console.log("No user"); process.exit(1); }

  const { signToken } = require("./src/auth/middleware");
  const token = signToken(user.id);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  try {
    const res = await axios.get("http://localhost:4000/api/transactions?limit=6", { headers });
    console.log("Transactions success!");
  } catch (e) {
    console.error("Transactions failed:", e);
  }

  process.exit(0);
}

test();
