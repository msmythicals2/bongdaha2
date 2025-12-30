require("dotenv").config();

const express = require("express");
const axios = require("axios");
const RSSParser = require("rss-parser");
const cors = require("cors");
const path = require("path");

const app = express();
const parser = new RSSParser();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FOOTBALL_API_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

if (!API_KEY) {
  console.error("FOOTBALL_API_KEY missing in .env");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// static
app.use(express.static(path.join(__dirname, "public")));

// home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API headers
const headers = {
  "x-apisports-key": API_KEY
};

// fixtures by date
app.get("/api/fixtures", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.json([]);

    const r = await axios.get(`${BASE_URL}/fixtures`, {
      headers,
      params: { date }
    });

    res.json(r.data?.response || []);
  } catch (err) {
    console.error("fixtures error:", err.message);
    res.json([]);
  }
});

// live fixtures
app.get("/api/live", async (req, res) => {
  try {
    const r = await axios.get(`${BASE_URL}/fixtures`, {
      headers,
      params: { live: "all" }
    });

    res.json(r.data?.response || []);
  } catch (err) {
    console.error("live error:", err.message);
    res.json([]);
  }
});

// news rss
app.get("/api/news", async (req, res) => {
  try {
    const feed = await parser.parseURL("https://vnexpress.net/rss/the-thao.rss");

    res.json(
      (feed.items || []).slice(0, 15).map(i => ({
        title: i.title,
        link: i.link,
        pubDate: i.pubDate
      }))
    );
  } catch (err) {
    console.error("news error:", err.message);
    res.json([]);
  }
});

// ===== Fixture Detail (REAL API) =====
app.get("/api/fixture-detail", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.json({});

    const r = await axios.get(
      `${BASE_URL}/fixtures`,
      {
        headers,
        params: { id }
      }
    );

    res.json(r.data || {});
  } catch (err) {
    console.error("fixture-detail error:", err.message);
    res.json({});
  }
});

// ✅ listen 必须在最后
app.listen(PORT, () => {
  console.log("Bongdaha Server Running");
  console.log(`http://localhost:${PORT}`);
});
