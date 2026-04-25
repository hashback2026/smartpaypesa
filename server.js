require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const PQueue = require("p-queue").default;

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

const queue = new PQueue({
    concurrency: 1,
    interval: parseInt(process.env.INTERVAL) || 10000,
    intervalCap: parseInt(process.env.RATE) || 5
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendSTK(number, amount) {
    try {
        const response = await axios.post(
            "https://api.smartpaypesa.com/v1/initiatestk",
            {
                api_key: process.env.API_KEY,
                amount: amount,
                msisdn: number,
                reference: "BULK_" + Date.now()
            },
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        return { number, status: "success", data: response.data };

    } catch (error) {
        return {
            number,
            status: "failed",
            error: error.response?.data || error.message
        };
    }
}

app.post("/send-bulk", async (req, res) => {
    const { numbers, amount } = req.body;

    if (!numbers || !amount) {
        return res.status(400).json({ error: "Missing data" });
    }

    let results = [];

    for (let number of numbers) {
        queue.add(async () => {
            const result = await sendSTK(number, amount);
            results.push(result);
            await delay(1500);
        });
    }

    await queue.onIdle();

    res.json({
        total: numbers.length,
        processed: results.length,
        results
    });
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
