import mongoose from "mongoose";
import { User, connectDb } from "./src/db";
import { accountsWithBalances } from "./src/lib/balances";

async function test() {
  await connectDb();
  console.log("Connected");
  const user = await User.findOne();
  if (!user) {
    console.log("No user found");
    process.exit(1);
  }
  
  try {
    const balances = await accountsWithBalances(user.id);
    console.log("Balances:", balances);
  } catch (e) {
    console.error("Balances Error:", e);
  }

  process.exit(0);
}

test();
