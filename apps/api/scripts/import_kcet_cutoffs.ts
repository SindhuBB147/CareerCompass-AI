// import_kcet_cutoffs.ts
// Script to import KCET engineering cutoff data from downloaded PDFs.
// It parses PDF text using pdf-parse, extracts simple rank lines, and upserts into the Cutoff collection.

import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import pdf = require('pdf-parse');
import { Cutoff, CutoffDocument } from '../src/modules/cutoffs/models/cutoff.model';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/career-compass-dev';

const SOURCE_DIR = path.resolve(__dirname, '../data/kcet-sources');

interface SourceManifestEntry {
  fileName: string;
  url: string;
  year: number;
  round: number;
}

const manifest: SourceManifestEntry[] = [];

function inferMetadata(fileName: string): { year: number; round: number } | null {
  const lower = fileName.toLowerCase();
  const yearMatch = lower.match(/(202[3-5])/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1]);
  let round = 1;
  if (lower.includes('r2') || lower.includes('round2') || lower.includes('r2english')) round = 2;
  else if (lower.includes('enr2') || lower.includes('final') || lower.includes('extended')) round = 3;
  else if (lower.includes('gen') && lower.includes('round1')) round = 1;
  return { year, round };
}

const lineRegex = /^(\w{2,5})\s+([A-Za-z&\s]+?)\s+(GM|1G|2A|2B|3A|3B|SC|ST)\s+(\d+)$/i;

async function processPdf(filePath: string, sourceUrl: string) {
  const fileName = path.basename(filePath);
  const meta = inferMetadata(fileName);
  if (!meta) {
    console.warn(`Unable to infer year/round from ${fileName}, skipping.`);
    return;
  }
  const data = fs.readFileSync(filePath);
  const pdfData = await pdf(data);
  const lines = pdfData.text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  for (const line of lines) {
    const m = line.match(lineRegex);
    if (!m) continue;
    const [, collegeId, courseName, category, rankStr] = m;
    const closingRank = parseInt(rankStr, 10);
    const courseId = `${collegeId.toUpperCase()}-${courseName.replace(/\s+/g, '-').toUpperCase()}`;
    const filter = {
      collegeId: collegeId.toUpperCase(),
      courseId,
      examCode: 'KCET',
      year: meta.year,
      round: meta.round,
      category: category.toUpperCase(),
    };
    const update = {
      $set: {
        collegeId: collegeId.toUpperCase(),
        courseId,
        courseName: courseName.trim(),
        examCode: 'KCET',
        year: meta.year,
        round: meta.round,
        category: category.toUpperCase(),
        closingRank,
        source: 'official',
        status: 'verified',
        metadata: { sourceUrl, importedAt: new Date() },
        lastUpdated: new Date(),
      },
    };
    await CutoffModel.updateOne(filter, update, { upsert: true });
  }
  manifest.push({ fileName, url: sourceUrl, year: meta.year, round: meta.round });
}

import { model, Schema } from 'mongoose';
const CutoffSchema = new Schema({}, { strict: false });
const CutoffModel = model<CutoffDocument>('Cutoff', CutoffSchema);

async function run() {
  console.log('Connecting to MongoDB:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  for (const file of files) {
    const filePath = path.join(SOURCE_DIR, file);
    const sourceUrl = `https://cetonline.karnataka.gov.in/keawebentry456/${file}`;
    console.log(`Processing ${file} ...`);
    try {
      await processPdf(filePath, sourceUrl);
      console.log(`✅ ${file} processed`);
    } catch (err) {
      console.error(`❌ Error processing ${file}:`, err);
    }
  }
  const manifestPath = path.join(SOURCE_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log('Import complete. Manifest written to', manifestPath);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
