import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/**
 * @param {Object} file - O arquivo vindo do Multer (req.file)
 * @param {string} folder - 'products', 'users' ou 'vehicles'
 * @param {string} id - O ID do registro no MongoDB
 */
export const uploadAndOptimizeImage = async (file, folder, id) => {
  try {
    // 1. Otimização: Transforma em WebP (leve) e redimensiona
    const optimizedBuffer = await sharp(file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // 2. Define o caminho: pasta/id.webp (Ex: products/65f123...webp)
    const fileName = `${folder}/${id}.webp`;

    // 3. Upload para o Supabase (Bucket 'box')
    // O upsert: true garante que, se o arquivo existir, ele seja substituído.
    console.log(`[uploadImageController] upload attempt: ${fileName}`);
    let result = await supabase.storage.from('box').upload(fileName, optimizedBuffer, {
      contentType: 'image/webp',
      cacheControl: '0',
      upsert: true,
    });

    if (result.error) {
      console.warn(`[uploadImageController] upload failed, fallback remove?`, result.error.message || result.error);
      if (String(result.error.message || result.error).toLowerCase().includes('already exists')) {
        try {
          await supabase.storage.from('box').remove([fileName]);
          console.log(`[uploadImageController] removed existing file, retrying upload: ${fileName}`);
          result = await supabase.storage.from('box').upload(fileName, optimizedBuffer, {
            contentType: 'image/webp',
            cacheControl: '0',
            upsert: true,
          });
        } catch (cleanupError) {
          console.error(`[uploadImageController] fallback remove failed: ${fileName}`, cleanupError);
          throw cleanupError;
        }
      }
    }

    if (result.error) {
      const errorMessage = String(result.error.message || result.error);
      console.error(`[uploadImageController] upload error for ${fileName}:`, errorMessage);
      throw new Error(errorMessage);
    }

    console.log(`[uploadImageController] upload success: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error("Erro no serviço de upload:", error);
    throw new Error("Erro ao processar imagem.");
  }
};