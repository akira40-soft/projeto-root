const axios = require('axios');
const axiosRetry = require('axios-retry');

// Configurar retries automáticos com axios-retry
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 5000, // 5s, 10s, 15s
  retryCondition: (error) => {
    return error.code === 'ECONNABORTED' || error.response?.status >= 500;
  }
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { message, sender, sender_number, is_group, mentioned, replied_to_akira, quoted_msg } = req.body;

  try {
    const config = require('../config');
    const API_URL = config.API_URL || "https://flask-fzw0.onrender.com";

    // Verificar saúde do Flask no Render antes de enviar a requisição
    const healthResponse = await axios.get(`${API_URL}/health`, { timeout: 60000 });
    if (healthResponse.status !== 200 || healthResponse.data.status !== "healthy") {
      throw new Error('Servidor Flask não está saudável');
    }

    const response = await axios.post(`${API_URL}/bot`, {
      message,
      sender,
      sender_number,
      is_group,
      mentioned,
      replied_to_akira,
      quoted_msg
    }, {
      timeout: 60000 // Timeout de 60s para cobrir o delay do Render
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Erro na requisição:', error.message);
    return res.status(500).json({ error: 'Erro ao processar a requisição', details: error.message });
  }
};
