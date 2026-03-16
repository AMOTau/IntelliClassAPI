const axios = require('axios');

const HF_API_URL = 'https://api-inference.huggingface.co/models/';
const HF_MODEL = process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';

/**
 * Builds a prompt for MCQ generation.
 */
const buildPrompt = (text, numQuestions) => {
  const excerpt = text.slice(0, 3000); // limit input size
  return `[INST] You are an educational quiz creator. Based on the following study material, generate exactly ${numQuestions} multiple-choice question(s).

For each question output ONLY valid JSON in this exact format (an array):
[
  {
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "A"
  }
]

Rules:
- correct_answer must be exactly one of: A, B, C, D
- All options must be meaningful and plausible
- Questions must be directly based on the provided text
- Return ONLY the JSON array, no explanation, no markdown

Study Material:
${excerpt}
[/INST]`;
};

/**
 * Parse JSON array from AI response text (handles markdown code blocks).
 */
const parseAIResponse = (text) => {
  // Remove markdown code fences if present
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // Find JSON array boundaries
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');

  if (start === -1 || end === -1) {
    throw new Error('AI response did not contain a valid JSON array.');
  }

  return JSON.parse(cleaned.slice(start, end + 1));
};

/**
 * Validate generated questions.
 */
const validateQuestions = (questions) => {
  const validAnswers = ['A', 'B', 'C', 'D'];
  return questions.filter(
    (q) =>
      q.question_text &&
      q.option_a &&
      q.option_b &&
      validAnswers.includes(String(q.correct_answer).toUpperCase())
  );
};

/**
 * Generate quiz questions from study material text using Hugging Face API.
 * @param {string} text - Extracted text from the study material.
 * @param {number} numQuestions - Number of questions to generate.
 * @returns {Promise<Array>} Array of question objects.
 */
const generateQuizQuestions = async (text, numQuestions = 5) => {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    throw new Error('Hugging Face API key is not configured. Please set HUGGINGFACE_API_KEY in your .env file.');
  }

  const prompt = buildPrompt(text, numQuestions);

  try {
    const response = await axios.post(
      `${HF_API_URL}${HF_MODEL}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 1200,
          temperature: 0.7,
          return_full_text: false,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000, // 60 second timeout
      }
    );

    let generatedText;

    if (Array.isArray(response.data) && response.data[0]?.generated_text) {
      generatedText = response.data[0].generated_text;
    } else if (response.data?.generated_text) {
      generatedText = response.data.generated_text;
    } else {
      throw new Error('Unexpected response format from Hugging Face API.');
    }

    const parsed = parseAIResponse(generatedText);
    const validated = validateQuestions(parsed);

    if (validated.length === 0) {
      throw new Error('AI did not generate valid questions. Please try again.');
    }

    return validated.map((q) => ({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c || null,
      option_d: q.option_d || null,
      correct_answer: String(q.correct_answer).toUpperCase(),
      marks: 1,
    }));
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 503) {
        throw new Error('AI model is currently loading. Please wait a moment and try again.');
      }
      if (status === 401) {
        throw new Error('Invalid Hugging Face API key.');
      }
      throw new Error(`Hugging Face API error: ${err.response.data?.error || err.message}`);
    }
    throw err;
  }
};

module.exports = { generateQuizQuestions };
