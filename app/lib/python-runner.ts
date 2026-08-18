import { spawn } from "child_process";
import path from "path";

export interface PythonResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTimeMs?: number;
}

/**
 * Safely executes a Python script from python_services/scripts/ and returns parsed output.
 */
export async function runPythonScript<T = any>(
  scriptRelativePath: string,
  args: string[] = []
): Promise<PythonResult<T>> {
  const startTime = Date.now();
  const scriptsDir = path.join(process.cwd(), "python_services", "scripts");
  const fullScriptPath = path.join(scriptsDir, scriptRelativePath);

  return new Promise((resolve) => {
    // Spawn python3 or python process
    const pythonExecutable = process.env.PYTHON_PATH || "python3";
    const child = spawn(pythonExecutable, [fullScriptPath, ...args]);

    let stdoutData = "";
    let stderrData = "";

    child.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    child.on("error", (err) => {
      resolve({
        success: false,
        error: `Failed to start Python process: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
      });
    });

    child.on("close", (code) => {
      const executionTimeMs = Date.now() - startTime;
      if (code !== 0) {
        resolve({
          success: false,
          error: stderrData || `Python script exited with code ${code}`,
          executionTimeMs,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        resolve({
          success: true,
          data: parsed,
          executionTimeMs,
        });
      } catch {
        resolve({
          success: true,
          data: stdoutData.trim() as unknown as T,
          executionTimeMs,
        });
      }
    });
  });
}
