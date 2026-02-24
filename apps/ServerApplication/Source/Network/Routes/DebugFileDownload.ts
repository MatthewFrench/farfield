import fs from "node:fs";
import type { ServerResponse } from "node:http";

export async function streamDebugFileDownload(
  res: ServerResponse,
  filePath: string,
  downloadFileName: string
): Promise<void> {
  const fileStats = await fs.promises.stat(filePath);
  if (!fileStats.isFile()) {
    throw new Error("Requested download path is not a file");
  }

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson",
    "Content-Length": fileStats.size,
    "Content-Disposition": `attachment; filename=\"${downloadFileName}\"`,
    "Access-Control-Allow-Origin": "*"
  });

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.once("error", reject);
    stream.once("end", resolve);
    stream.pipe(res);
  });
}
