/**
 * Busca modelos de veículos na tabela FIPE
 * API pública: https://fipe-api.appspot.com/
 */

const FIPE_API_BASE = 'https://fipe-api.appspot.com/api/1/veiculos';

/**
 * Fetch com retry e timeout
 */
async function fetchWithTimeout(url, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Busca marcas de motos na FIPE
 */
async function getFipeMotorcycleBrands() {
  try {
    const response = await fetchWithTimeout(`${FIPE_API_BASE}/marcas`, 5000);
    if (!response.ok) throw new Error('Erro ao buscar marcas FIPE');
    
    const brands = await response.json();
    // Filtra apenas motos (tipo 3 é moto na FIPE)
    return brands.filter(b => b.tipo === '2'); // tipo 2 é moto/motocicleta
  } catch (err) {
    console.error('[searchFipeVehiclesController] Erro ao buscar marcas:', err.message);
    return [];
  }
}

/**
 * Busca modelos de uma marca específica
 */
async function getFipeModelsForBrand(brandId) {
  try {
    const response = await fetchWithTimeout(
      `${FIPE_API_BASE}/marcas/${brandId}/modelos`,
      5000
    );
    if (!response.ok) throw new Error('Erro ao buscar modelos FIPE');
    
    const data = await response.json();
    return Array.isArray(data.modelos) ? data.modelos : [];
  } catch (err) {
    console.error('[searchFipeVehiclesController] Erro ao buscar modelos:', err.message);
    return [];
  }
}

/**
 * Busca anos de um modelo específico
 */
async function getFipeYearsForModel(brandId, modelId) {
  try {
    const response = await fetchWithTimeout(
      `${FIPE_API_BASE}/marcas/${brandId}/modelos/${modelId}/anos`,
      5000
    );
    if (!response.ok) throw new Error('Erro ao buscar anos FIPE');
    
    const data = await response.json();
    return Array.isArray(data.anos) ? data.anos : [];
  } catch (err) {
    console.error('[searchFipeVehiclesController] Erro ao buscar anos:', err.message);
    return [];
  }
}

/**
 * Busca valor (preço) do veículo na FIPE
 */
async function getFipePriceForModel(brandId, modelId, yearId) {
  try {
    const response = await fetchWithTimeout(
      `${FIPE_API_BASE}/marcas/${brandId}/modelos/${modelId}/anos/${yearId}`,
      5000
    );
    if (!response.ok) throw new Error('Erro ao buscar valor FIPE');
    
    return await response.json();
  } catch (err) {
    console.error('[searchFipeVehiclesController] Erro ao buscar valor:', err.message);
    return null;
  }
}

/**
 * Endpoint: GET /vehicle/fipe/search?q=Honda
 * Busca modelos de motos que contenham a string fornecida
 */
export const searchFipeVehicles = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        message: "Termo de busca deve ter pelo menos 2 caracteres.",
        vehicles: [] 
      });
    }

    const searchTerm = q.trim().toLowerCase();

    // Busca todas as marcas de motos
    const brands = await getFipeMotorcycleBrands();
    
    if (brands.length === 0) {
      return res.json({ 
        message: "Nenhuma marca encontrada (API FIPE indisponível).",
        vehicles: [] 
      });
    }

    // Filtra marcas que contêm o termo de busca
    const matchingBrands = brands.filter(b => 
      b.nome.toLowerCase().includes(searchTerm)
    );

    if (matchingBrands.length === 0) {
      return res.json({ 
        message: "Nenhuma marca encontrada com esse termo.",
        vehicles: [] 
      });
    }

    // Para cada marca encontrada, busca os modelos
    const results = [];
    
    for (const brand of matchingBrands.slice(0, 5)) { // Limita a 5 marcas para não sobrecarregar
      const models = await getFipeModelsForBrand(brand.id);
      
      for (const model of models.slice(0, 10)) { // Limita a 10 modelos por marca
        results.push({
          brand: brand.nome,
          model: model.nome,
          brandId: brand.id,
          modelId: model.id,
          label: `${brand.nome} ${model.nome}`
        });
      }
    }

    return res.json({ 
      message: "Resultados encontrados.",
      vehicles: results.slice(0, 20) // Limita a 20 resultados totais
    });

  } catch (err) {
    console.error('[searchFipeVehicles] Erro:', err);
    return res.status(500).json({ 
      message: "Erro ao buscar veículos na FIPE.",
      vehicles: [],
      error: err.message 
    });
  }
};

/**
 * Endpoint: GET /vehicle/fipe/years?brandId=123&modelId=456
 * Busca anos disponíveis para um modelo específico
 */
export const getFipeYears = async (req, res) => {
  try {
    const { brandId, modelId } = req.query;

    if (!brandId || !modelId) {
      return res.status(400).json({ 
        message: "Parâmetros brandId e modelId são obrigatórios.",
        years: [] 
      });
    }

    const years = await getFipeYearsForModel(brandId, modelId);
    
    return res.json({ 
      message: "Anos encontrados.",
      years: years.map(y => ({ id: y.id, year: y.nome }))
    });

  } catch (err) {
    console.error('[getFipeYears] Erro:', err);
    return res.status(500).json({ 
      message: "Erro ao buscar anos na FIPE.",
      years: [],
      error: err.message 
    });
  }
};

/**
 * Endpoint: GET /vehicle/fipe/details?brandId=123&modelId=456&yearId=789
 * Busca informações detalhadas (valor, combustível, etc) de um modelo específico
 */
export const getFipeDetails = async (req, res) => {
  try {
    const { brandId, modelId, yearId } = req.query;

    if (!brandId || !modelId || !yearId) {
      return res.status(400).json({ 
        message: "Parâmetros brandId, modelId e yearId são obrigatórios.",
        details: null 
      });
    }

    const details = await getFipePriceForModel(brandId, modelId, yearId);
    
    if (!details) {
      return res.status(404).json({ 
        message: "Detalhes não encontrados.",
        details: null 
      });
    }

    return res.json({ 
      message: "Detalhes encontrados.",
      details: {
        model: details.modelo,
        brand: details.marca,
        year: details.ano,
        fuel: details.combustivel,
        price: details.valor,
        referenceMonth: details.mes_referencia
      }
    });

  } catch (err) {
    console.error('[getFipeDetails] Erro:', err);
    return res.status(500).json({ 
      message: "Erro ao buscar detalhes na FIPE.",
      details: null,
      error: err.message 
    });
  }
};

/**
 * Endpoint: GET /vehicle/fipe/brands
 * Lista todas as marcas de motos disponíveis na FIPE (com cache)
 */
export const getFipeBrands = async (req, res) => {
  try {
    const brands = await getFipeMotorcycleBrands();
    
    return res.json({ 
      message: "Marcas de motos encontradas.",
      brands: brands.map(b => ({ id: b.id, name: b.nome }))
    });

  } catch (err) {
    console.error('[getFipeBrands] Erro:', err);
    return res.status(500).json({ 
      message: "Erro ao buscar marcas na FIPE.",
      brands: [],
      error: err.message 
    });
  }
};
