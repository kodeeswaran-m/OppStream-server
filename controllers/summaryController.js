const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateSummary = async (req, res) => {
  try {
    const { detailedNotes } = req.body;

    if (!detailedNotes) {
      return res.status(400).json({ message: "Detailed notes required" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
You are an enterprise CRM assistant.

TASK:
Summarize the content ONLY if it is related to:
- IT services
- Software products
- Cloud, web, mobile, or enterprise applications
- Digital transformation, migration, modernization, or system integration

RULES:
- If the content is NOT related to IT services or software products, respond exactly with:
  "Not applicable – content is not related to IT services or products."
- If applicable, generate ONE short professional summary.
- Maximum 25 words.
- No bullet points.
- No extra explanation.

CONTENT:
${detailedNotes}
`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();

    res.status(200).json({ summary });
  } catch (error) {
    console.error("Gemini error:", error);
    res.status(500).json({
      message: "Failed to generate summary",
    });
  }
};

module.exports = { generateSummary };



// const { GoogleGenerativeAI } = require("@google/generative-ai");

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// const generateSummary = async (req, res) => {
//   try {
//     const { detailedNotes } = req.body;

//     if (!detailedNotes) {
//       return res.status(400).json({ message: "Detailed notes required" });
//     }

//     const model = genAI.getGenerativeModel({
//       model: "gemini-2.5-flash",
//     });

//     const prompt = `
// Summarize the following opportunity notes into ONE short professional sentence (max 25 words):

// ${detailedNotes}
// `;

//     const result = await model.generateContent(prompt);
//     const summary = result.response.text().trim();

//     res.status(200).json({ summary });
//   } catch (error) {
//     console.error("Gemini error:", error);
//     res.status(500).json({ message: error || "Failed to generate summary" });
//   }
// };

// module.exports = { generateSummary };
