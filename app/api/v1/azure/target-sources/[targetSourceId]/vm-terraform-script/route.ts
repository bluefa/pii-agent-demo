import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import type { AzureTerraformScript } from '@/lib/types/azure';

/** Build a minimal ZIP archive containing a single file using only Buffer (no dependencies). */
const buildZip = (fileName: string, content: Buffer): Buffer => {
  const crc32 = (buf: Buffer): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const nameBytes = Buffer.from(fileName, 'utf-8');
  const crc = crc32(content);
  const compressedSize = content.length;
  const uncompressedSize = content.length;

  // Local file header (30 + nameLen + fileData)
  const localHeader = Buffer.alloc(30 + nameBytes.length);
  localHeader.writeUInt32LE(0x04034b50, 0); // signature
  localHeader.writeUInt16LE(20, 4);          // version needed
  localHeader.writeUInt16LE(0, 6);           // flags
  localHeader.writeUInt16LE(0, 8);           // compression: stored
  localHeader.writeUInt16LE(0, 10);          // mod time
  localHeader.writeUInt16LE(0, 12);          // mod date
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(compressedSize, 18);
  localHeader.writeUInt32LE(uncompressedSize, 22);
  localHeader.writeUInt16LE(nameBytes.length, 26);
  localHeader.writeUInt16LE(0, 28);          // extra field length
  nameBytes.copy(localHeader, 30);

  const centralDirOffset = localHeader.length + content.length;

  // Central directory header (46 + nameLen)
  const centralHeader = Buffer.alloc(46 + nameBytes.length);
  centralHeader.writeUInt32LE(0x02014b50, 0); // signature
  centralHeader.writeUInt16LE(20, 4);          // version made by
  centralHeader.writeUInt16LE(20, 6);          // version needed
  centralHeader.writeUInt16LE(0, 8);           // flags
  centralHeader.writeUInt16LE(0, 10);          // compression: stored
  centralHeader.writeUInt16LE(0, 12);          // mod time
  centralHeader.writeUInt16LE(0, 14);          // mod date
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(compressedSize, 20);
  centralHeader.writeUInt32LE(uncompressedSize, 24);
  centralHeader.writeUInt16LE(nameBytes.length, 28);
  centralHeader.writeUInt16LE(0, 30);          // extra field length
  centralHeader.writeUInt16LE(0, 32);          // comment length
  centralHeader.writeUInt16LE(0, 34);          // disk number start
  centralHeader.writeUInt16LE(0, 36);          // internal attributes
  centralHeader.writeUInt32LE(0, 38);          // external attributes
  centralHeader.writeUInt32LE(0, 42);          // local header offset
  nameBytes.copy(centralHeader, 46);

  // End of central directory (22 bytes)
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);                // signature
  endRecord.writeUInt16LE(0, 4);                          // disk number
  endRecord.writeUInt16LE(0, 6);                          // central dir disk
  endRecord.writeUInt16LE(1, 8);                          // entries on disk
  endRecord.writeUInt16LE(1, 10);                         // total entries
  endRecord.writeUInt32LE(centralHeader.length, 12);      // central dir size
  endRecord.writeUInt32LE(centralDirOffset, 16);          // central dir offset
  endRecord.writeUInt16LE(0, 20);                         // comment length

  return Buffer.concat([localHeader, content, centralHeader, endRecord]);
};

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.azure.vmGetTerraformScript(resolved.projectId);
  if (!response.ok) return response;

  const data: AzureTerraformScript = await response.json();

  const tfContent = Buffer.from(
    `# Auto-generated Terraform script\n` +
    `# Target Source: ${params.targetSourceId}\n` +
    `# Generated at: ${data.generatedAt}\n` +
    `\n` +
    `terraform {\n` +
    `  required_providers {\n` +
    `    azurerm = {\n` +
    `      source  = "hashicorp/azurerm"\n` +
    `      version = "~> 3.0"\n` +
    `    }\n` +
    `  }\n` +
    `}\n`,
    'utf-8',
  );

  const zipBuffer = buildZip('main.tf', tfContent);
  const zipFileName = data.fileName.replace(/\.tf$/, '.zip');

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${zipFileName}"`,
    },
  });
});
