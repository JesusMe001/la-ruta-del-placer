/**
 * attach-product-images.js
 *
 * Copia las fotos de producto YA CONFIRMADAS contra Informix (sucursal 924,
 * bodega 3 — ver verificar-productos-drive.ps1 / reporte-verificacion-productos.csv)
 * hacia lilax-frontend/public/products/<codigo>.<ext>, y actualiza
 * products.image_url por legacy_cod_prod para cada una.
 *
 * No sube TODAS las fotos del Drive, solo las 127 que el cruce contra
 * saeprod/saeppr confirmó como productos reales que Lilax vende hoy.
 *
 * Uso (desde lilax-backend/):
 *   node scripts/attach-product-images.js
 *   node scripts/attach-product-images.js --hotel <slug-o-id>   (si hay más de un hotel)
 *   node scripts/attach-product-images.js --source "C:\ruta\a\la-ruta-del-placer"  (si este
 *       script no vive dentro del mismo checkout que tiene las carpetas de fotos)
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// codigo -> { carpeta, archivo }  (127 confirmados como CONFIRMADO_LILAX)
const CONFIRMED = {
  // VARIOS
  '203': { carpeta: 'VARIOS', archivo: '203.jpg' },
  '204': { carpeta: 'VARIOS', archivo: '204.jpg' },
  '205': { carpeta: 'VARIOS', archivo: '205.jpg' },
  '210': { carpeta: 'VARIOS', archivo: '210.png' },
  '214': { carpeta: 'VARIOS', archivo: '214.jpg' },
  '215': { carpeta: 'VARIOS', archivo: '215.png' },
  '305': { carpeta: 'VARIOS', archivo: '305.png' },
  '473': { carpeta: 'VARIOS', archivo: '473.png' },
  '652': { carpeta: 'VARIOS', archivo: '652.png' },
  '810': { carpeta: 'VARIOS', archivo: '810.png' },
  // PRESERVATIVOS
  '10146': { carpeta: 'PRESERVATIVOS', archivo: '10146.png' },
  '10147': { carpeta: 'PRESERVATIVOS', archivo: '10147.png' },
  '10148': { carpeta: 'PRESERVATIVOS', archivo: '10148.png' },
  '10150': { carpeta: 'PRESERVATIVOS', archivo: '10150.png' },
  '10151': { carpeta: 'PRESERVATIVOS', archivo: '10151.png' },
  '10153': { carpeta: 'PRESERVATIVOS', archivo: '10153.png' },
  '10155': { carpeta: 'PRESERVATIVOS', archivo: '10155.png' },
  '10156': { carpeta: 'PRESERVATIVOS', archivo: '10156.png' },
  '10162': { carpeta: 'PRESERVATIVOS', archivo: '10162.jpg' },
  '10164': { carpeta: 'PRESERVATIVOS', archivo: '10164.jpg' },
  '216': { carpeta: 'PRESERVATIVOS', archivo: '216.png' },
  '228': { carpeta: 'PRESERVATIVOS', archivo: '228.png' },
  // LUBRICANTES
  '223': { carpeta: 'LUBRICANTES', archivo: '223.jpg' },
  '224': { carpeta: 'LUBRICANTES', archivo: '224.jpg' },
  '225': { carpeta: 'LUBRICANTES', archivo: '225.jpg' },
  '231': { carpeta: 'LUBRICANTES', archivo: '231.webp' },
  '235': { carpeta: 'LUBRICANTES', archivo: '235.jpg' },
  // LICORES
  '005': { carpeta: 'LICORES', archivo: '005.png' },
  '0100': { carpeta: 'LICORES', archivo: '0100.jpg' },
  '058': { carpeta: 'LICORES', archivo: '058.png' },
  '074': { carpeta: 'LICORES', archivo: '074.png' },
  '078': { carpeta: 'LICORES', archivo: '078.png' },
  '083': { carpeta: 'LICORES', archivo: '083.png' },
  '086': { carpeta: 'LICORES', archivo: '086.png' },
  '090': { carpeta: 'LICORES', archivo: '090.png' },
  '091': { carpeta: 'LICORES', archivo: '091.png' },
  '097': { carpeta: 'LICORES', archivo: '097.png' },
  '098': { carpeta: 'LICORES', archivo: '098.png' },
  '099': { carpeta: 'LICORES', archivo: '099.png' },
  '1000118': { carpeta: 'LICORES', archivo: '1000118.png' },
  '1000119': { carpeta: 'LICORES', archivo: '1000119.png' },
  '10166': { carpeta: 'LICORES', archivo: '10166.png' },
  '807': { carpeta: 'LICORES', archivo: '807.png' },
  '808': { carpeta: 'LICORES', archivo: '808.png' },
  // GASEOSAS
  '100': { carpeta: 'GASEOSAS', archivo: '100.png' },
  '101P': { carpeta: 'GASEOSAS', archivo: '101P.png' },
  '10227': { carpeta: 'GASEOSAS', archivo: '10227.png' },
  '10228': { carpeta: 'GASEOSAS', archivo: '10228.png' },
  '10250': { carpeta: 'GASEOSAS', archivo: '10250.png' },
  '10251': { carpeta: 'GASEOSAS', archivo: '10251.png' },
  '102P': { carpeta: 'GASEOSAS', archivo: '102P.png' },
  '103P': { carpeta: 'GASEOSAS', archivo: '103P.png' },
  '131': { carpeta: 'GASEOSAS', archivo: '131.png' },
  // Energizantes
  '113': { carpeta: 'Energizantes', archivo: '113.png' },
  '116': { carpeta: 'Energizantes', archivo: '116.png' },
  '120': { carpeta: 'Energizantes', archivo: '120.png' },
  // Cigarrillo
  '201': { carpeta: 'Cigarrillo', archivo: '201.png' },
  '202': { carpeta: 'Cigarrillo', archivo: '202.png' },
  '801': { carpeta: 'Cigarrillo', archivo: '801.png' },
  '802': { carpeta: 'Cigarrillo', archivo: '802.png' },
  '805': { carpeta: 'Cigarrillo', archivo: '805.png' },
  // Cervezas
  '009': { carpeta: 'Cervezas', archivo: '009.png' },
  '010': { carpeta: 'Cervezas', archivo: '010.png' },
  '012': { carpeta: 'Cervezas', archivo: '012.png' },
  '013': { carpeta: 'Cervezas', archivo: '013.png' },
  '016': { carpeta: 'Cervezas', archivo: '016.png' },
  '020': { carpeta: 'Cervezas', archivo: '020.png' },
  '022': { carpeta: 'Cervezas', archivo: '022.png' },
  '0601': { carpeta: 'Cervezas', archivo: '0601.png' },
  '0602': { carpeta: 'Cervezas', archivo: '0602.png' },
  '10142': { carpeta: 'Cervezas', archivo: '10142.png' },
  '10143': { carpeta: 'Cervezas', archivo: '10143.png' },
  '10181': { carpeta: 'Cervezas', archivo: '10181.png' },
  '10247': { carpeta: 'Cervezas', archivo: '10247.png' },
  '10248': { carpeta: 'Cervezas', archivo: '10248.png' },
  // Aseo personal
  '108': { carpeta: 'Aseo personal', archivo: '108.png' },
  '207': { carpeta: 'Aseo personal', archivo: '207.png' },
  '208': { carpeta: 'Aseo personal', archivo: '208.png' },
  '403': { carpeta: 'Aseo personal', archivo: '403.jpg' },
  '404': { carpeta: 'Aseo personal', archivo: '404.png' },
  '405': { carpeta: 'Aseo personal', archivo: '405.jpg' },
  '413': { carpeta: 'Aseo personal', archivo: '413.png' },
  '424': { carpeta: 'Aseo personal', archivo: '424.png' },
  '443': { carpeta: 'Aseo personal', archivo: '443.png' },
  '471': { carpeta: 'Aseo personal', archivo: '471.png' },
  // Aguas y Jugos
  '10179': { carpeta: 'Aguas y Jugos', archivo: '10179.png' },
  '10180': { carpeta: 'Aguas y Jugos', archivo: '10180.png' },
  '106': { carpeta: 'Aguas y Jugos', archivo: '106.png' },
  '107': { carpeta: 'Aguas y Jugos', archivo: '107.png' },
  '123': { carpeta: 'Aguas y Jugos', archivo: '123.png' },
  '126': { carpeta: 'Aguas y Jugos', archivo: '126.png' },
  '127': { carpeta: 'Aguas y Jugos', archivo: '127.png' },
  '156': { carpeta: 'Aguas y Jugos', archivo: '156.png' },
  // Alimentos
  '109': { carpeta: 'Alimentos', archivo: '109.png' },
  '114': { carpeta: 'Alimentos', archivo: '114.png' },
  '301': { carpeta: 'Alimentos', archivo: '301.jpg' },
  '304': { carpeta: 'Alimentos', archivo: '304.jpg' },
  '306': { carpeta: 'Alimentos', archivo: '306.png' },
  '307': { carpeta: 'Alimentos', archivo: '307.png' },
  '309': { carpeta: 'Alimentos', archivo: '309.png' },
  '310': { carpeta: 'Alimentos', archivo: '310.png' },
  '4001': { carpeta: 'Alimentos', archivo: '4001.png' },
  '4002': { carpeta: 'Alimentos', archivo: '4002.png' },
  '4003': { carpeta: 'Alimentos', archivo: '4003.png' },
  '4004': { carpeta: 'Alimentos', archivo: '4004.png' },
  '4005': { carpeta: 'Alimentos', archivo: '4005.png' },
  '603': { carpeta: 'Alimentos', archivo: '603.png' },
  '606': { carpeta: 'Alimentos', archivo: '606.png' },
  '608': { carpeta: 'Alimentos', archivo: '608.png' },
  '609': { carpeta: 'Alimentos', archivo: '609.png' },
  '615': { carpeta: 'Alimentos', archivo: '615.png' },
  '619': { carpeta: 'Alimentos', archivo: '619.png' },
  '623': { carpeta: 'Alimentos', archivo: '623.png' },
  '624': { carpeta: 'Alimentos', archivo: '624.png' },
  '625': { carpeta: 'Alimentos', archivo: '625.png' },
  '626': { carpeta: 'Alimentos', archivo: '626.png' },
  '627': { carpeta: 'Alimentos', archivo: '627.png' },
  '628': { carpeta: 'Alimentos', archivo: '628.png' },
  '629': { carpeta: 'Alimentos', archivo: '629.jpg' },
  '631': { carpeta: 'Alimentos', archivo: '631.jpg' },
  '632': { carpeta: 'Alimentos', archivo: '632.jpg' },
  '634': { carpeta: 'Alimentos', archivo: '634.jpg' },
  '653': { carpeta: 'Alimentos', archivo: '653.jpg' },
  '654': { carpeta: 'Alimentos', archivo: '654.jpg' },
  '657': { carpeta: 'Alimentos', archivo: '657.png' },
  '812': { carpeta: 'Alimentos', archivo: '812.jpg' },
  '930': { carpeta: 'Alimentos', archivo: '930.jpg' },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hotel') out.hotel = args[++i];
    if (args[i] === '--source') out.source = args[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const sourceRoot = args.source ? path.resolve(args.source) : path.resolve(__dirname, '..', '..');
  const destDir = path.resolve(__dirname, '..', '..', 'lilax-frontend', 'public', 'products');

  console.log('Carpeta origen (fotos del Drive):', sourceRoot);
  console.log('Carpeta destino (public/products):', destDir);

  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  let hotel;
  if (args.hotel) {
    hotel = await prisma.hotel.findFirst({ where: { OR: [{ id: args.hotel }, { slug: args.hotel }] } });
  } else {
    const hotels = await prisma.hotel.findMany();
    if (hotels.length === 0) throw new Error('No hay ningún hotel en la base.');
    if (hotels.length > 1) {
      throw new Error(
        'Hay más de un hotel — corre de nuevo con --hotel <slug-o-id>. Hoteles: ' +
          hotels.map((h) => `${h.slug} (${h.id})`).join(', '),
      );
    }
    hotel = hotels[0];
  }
  if (!hotel) throw new Error('Hotel no encontrado.');
  console.log('Hotel:', hotel.name, hotel.id);

  const copiados = [];
  const sinArchivoFuente = [];
  const sinProductoEnDb = [];

  for (const [codigo, info] of Object.entries(CONFIRMED)) {
    const srcPath = path.join(sourceRoot, info.carpeta, info.archivo);
    if (!fs.existsSync(srcPath)) {
      sinArchivoFuente.push({ codigo, srcPath });
      continue;
    }

    const ext = path.extname(info.archivo);
    const destFile = `${codigo}${ext}`;
    const destPath = path.join(destDir, destFile);
    fs.copyFileSync(srcPath, destPath);

    const result = await prisma.product.updateMany({
      where: { hotelId: hotel.id, legacyCodProd: codigo },
      data: { imageUrl: `/products/${destFile}` },
    });

    if (result.count === 0) {
      sinProductoEnDb.push(codigo);
    } else {
      copiados.push({ codigo, destFile, actualizados: result.count });
    }
  }

  console.log('\n=== COPIADOS Y ENLAZADOS ===');
  console.log(copiados.length, 'imágenes copiadas y vinculadas a un producto por legacy_cod_prod.');

  if (sinProductoEnDb.length) {
    console.log('\n=== IMAGEN COPIADA PERO SIN PRODUCTO EN POSTGRES (corre antes "2. Importar productos reales" en Admin → Informix) ===');
    console.log(sinProductoEnDb.join(', '));
  }

  if (sinArchivoFuente.length) {
    console.log('\n=== NO SE ENCONTRÓ EL ARCHIVO DE ORIGEN (revisa --source) ===');
    sinArchivoFuente.forEach((s) => console.log(s.codigo, '->', s.srcPath));
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('ERROR:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
