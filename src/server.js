import express from "express";
import cors from "cors";
import morgan from "morgan";
import axios from "axios";
import multer from "multer";
import translate from "translation-google";
import "dotenv/config";

const app = express();
const upload = multer();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

async function translateToThai(text) {
  try {
    if (!text || typeof text !== 'string') return text;
    
    const result = await translate(text, { from: 'en', to: 'th' });
    return result.text || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

app.post("/slip_verify", upload.single("image"), async (req, res) => {
  try {
    let dataUrl;

    if (req.file && req.file.buffer) {
      const mime = req.file.mimetype || "image/png";
      const b64 = req.file.buffer.toString("base64");
      dataUrl = `data:${mime};base64,${b64}`;
    } else {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ message: "No image provided in 'image' field." });
      }
      if (typeof image !== "string") {
        return res.status(400).json({ message: "'image' must be a string (base64 or data URL)." });
      }
      if (image.startsWith("data:")) {
        dataUrl = image;
      } else {
        dataUrl = `data:image/png;base64,${image}`;
      }
    }

    const endpointRoot = process.env.API_ENDPOINT;
    if (!endpointRoot) {
      return res.status(500).json({ message: "Server misconfiguration: API_ENDPOINT not set." });
    }

    const apiUrl = `${endpointRoot.replace(/\/$/, "")}/api/slip`;
    const response = await axios.post(
      apiUrl,
      { img: dataUrl },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    if (response.data && response.data.data) {
      const data = response.data.data;
      
      if (data.sender_name) {
        data.sender_name = await translateToThai(data.sender_name);
      }
      if (data.receiver_name) {
        data.receiver_name = await translateToThai(data.receiver_name);
      }

      if (data.sender_bank_details) {
        if (data.sender_bank_details.name) {
          data.sender_bank_details.name = await translateToThai(data.sender_bank_details.name);
        }
        if (data.sender_bank_details.official_name) {
          data.sender_bank_details.official_name = await translateToThai(data.sender_bank_details.official_name);
        }
      }

      if (data.receiver_bank_details) {
        if (data.receiver_bank_details.name) {
          data.receiver_bank_details.name = await translateToThai(data.receiver_bank_details.name);
        }
        if (data.receiver_bank_details.official_name) {
          data.receiver_bank_details.official_name = await translateToThai(data.receiver_bank_details.official_name);
        }
      }
    }

    return res.status(response.status).json(response.data);
  } catch (err) {
    console.error("Error /slip_verify:", err?.response?.data ?? err.message ?? err);
    if (err?.response?.data) {
      return res.status(err.response.status || 500).json({
        message: "Upstream API error",
        upstream: err.response.data,
      });
    }
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});