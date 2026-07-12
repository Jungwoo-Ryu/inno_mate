// ScreenshotHelper.ts

import path from "node:path";
import fs from "node:fs";
import { app } from "electron";
import { v4 as uuidv4 } from "uuid";
import { execFile } from "child_process";
import { promisify } from "util";
import screenshot from "screenshot-desktop";
import os from "os";

const execFileAsync = promisify(execFile);

export class ScreenshotHelper {
  private screenshotQueue: string[] = [];
  private extraScreenshotQueue: string[] = [];
  private readonly MAX_SCREENSHOTS = 5;

  private readonly screenshotDir: string;
  private readonly extraScreenshotDir: string;
  private readonly tempDir: string;

  private view: "queue" | "solutions" | "debug" = "queue";
  private getActiveDisplay: (() => Electron.Display | null) | null = null;

  constructor(view: "queue" | "solutions" | "debug" = "queue") {
    this.view = view;

    // Initialize directories
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots");
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots"
    );
    this.tempDir = path.join(
      app.getPath("temp"),
      "innomate-screenshots"
    );

    // Create directories if they don't exist
    this.ensureDirectoriesExist();

    // Clean existing screenshot directories when starting the app
    this.cleanScreenshotDirectories();
  }

  setActiveDisplayProvider(fn: () => Electron.Display | null): void {
    this.getActiveDisplay = fn;
  }

  private ensureDirectoriesExist(): void {
    const directories = [
      this.screenshotDir,
      this.extraScreenshotDir,
      this.tempDir,
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`Created directory: ${dir}`);
        } catch (err) {
          console.error(`Error creating directory ${dir}:`, err);
        }
      }
    }
  }

  // This method replaces loadExistingScreenshots() to ensure we start with empty queues
  private cleanScreenshotDirectories(): void {
    try {
      // Clean main screenshots directory
      if (fs.existsSync(this.screenshotDir)) {
        const files = fs
          .readdirSync(this.screenshotDir)
          .filter((file) => file.endsWith(".png"))
          .map((file) => path.join(this.screenshotDir, file));

        // Delete each screenshot file
        for (const file of files) {
          try {
            fs.unlinkSync(file);
            console.log(`Deleted existing screenshot: ${file}`);
          } catch (err) {
            console.error(`Error deleting screenshot ${file}:`, err);
          }
        }
      }

      // Clean extra screenshots directory
      if (fs.existsSync(this.extraScreenshotDir)) {
        const files = fs
          .readdirSync(this.extraScreenshotDir)
          .filter((file) => file.endsWith(".png"))
          .map((file) => path.join(this.extraScreenshotDir, file));

        // Delete each screenshot file
        for (const file of files) {
          try {
            fs.unlinkSync(file);
            console.log(`Deleted existing extra screenshot: ${file}`);
          } catch (err) {
            console.error(`Error deleting extra screenshot ${file}:`, err);
          }
        }
      }

      console.log("Screenshot directories cleaned successfully");
    } catch (err) {
      console.error("Error cleaning screenshot directories:", err);
    }
  }

  public getView(): "queue" | "solutions" | "debug" {
    return this.view;
  }

  public setView(view: "queue" | "solutions" | "debug"): void {
    console.log("Setting view in ScreenshotHelper:", view);
    console.log(
      "Current queues - Main:",
      this.screenshotQueue,
      "Extra:",
      this.extraScreenshotQueue
    );
    this.view = view;
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotQueue;
  }

  public getExtraScreenshotQueue(): string[] {
    console.log("Getting extra screenshot queue:", this.extraScreenshotQueue);
    return this.extraScreenshotQueue;
  }

  public clearQueues(): void {
    // Clear screenshotQueue
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(`Error deleting screenshot at ${screenshotPath}:`, err);
      });
    });
    this.screenshotQueue = [];

    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot at ${screenshotPath}:`,
            err
          );
      });
    });
    this.extraScreenshotQueue = [];
  }

  /**
   * 앱이 위치한 모니터만 전체 캡처 (듀얼 모니터에서 옆 화면 제외)
   */
  private async captureCurrentDisplay(): Promise<Buffer[]> {
    if (process.platform === "win32") {
      // Windows: 우선 현재 디스플레이 id로 시도, 실패 시 기존 폴백
      try {
        const screenId = await this.resolveScreenshotScreenId()
        if (screenId != null) {
          console.log(`[Screenshot] Capturing current display id=${screenId}`)
          const buffer = await screenshot({ screen: screenId, format: "png" })
          return [buffer]
        }
      } catch (err) {
        console.warn("Current-display capture failed, Windows fallback:", err)
      }
      return [await this.captureWindowsScreenshot()]
    }

    try {
      const screenId = await this.resolveScreenshotScreenId()
      if (screenId != null) {
        console.log(`[Screenshot] Capturing current display id=${screenId}`)
        const buffer = await screenshot({ screen: screenId, format: "png" })
        return [buffer]
      }
    } catch (err) {
      console.warn("Current-display capture failed, falling back:", err)
    }

    const buffer = await screenshot({ format: "png" })
    return [buffer]
  }

  /** Electron Display ↔ screenshot-desktop screen id 매칭 (좌→우 정렬 인덱스) */
  private async resolveScreenshotScreenId(): Promise<number | undefined> {
    const active = this.getActiveDisplay?.()
    const listed = await screenshot.listDisplays()
    if (!listed.length) return undefined
    if (!active || listed.length === 1) {
      return Number(listed[0].id)
    }

    const { screen } = await import("electron")
    const sortedElectron = [...screen.getAllDisplays()].sort(
      (a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y
    )
    const idx = sortedElectron.findIndex((d) => d.id === active.id)
    if (idx >= 0 && idx < listed.length) {
      return Number(listed[idx].id)
    }
    return Number(listed[0].id)
  }

  private async captureScreenshot(): Promise<Buffer> {
    const buffers = await this.captureCurrentDisplay()
    return buffers[0]
  }

  /**
   * Windows-specific screenshot capture with multiple fallback mechanisms
   */
  private async captureWindowsScreenshot(): Promise<Buffer> {
    console.log("Attempting Windows screenshot with multiple methods");

    // Method 1: Try screenshot-desktop with filename first
    try {
      const tempFile = path.join(this.tempDir, `temp-${uuidv4()}.png`);
      console.log(
        `Taking Windows screenshot to temp file (Method 1): ${tempFile}`
      );

      await screenshot({ filename: tempFile });

      if (fs.existsSync(tempFile)) {
        const buffer = await fs.promises.readFile(tempFile);
        console.log(
          `Method 1 successful, screenshot size: ${buffer.length} bytes`
        );

        // Cleanup temp file
        try {
          await fs.promises.unlink(tempFile);
        } catch (cleanupErr) {
          console.warn("Failed to clean up temp file:", cleanupErr);
        }

        return buffer;
      } else {
        console.log("Method 1 failed: File not created");
        throw new Error("Screenshot file not created");
      }
    } catch (error) {
      console.warn("Windows screenshot Method 1 failed:", error);

      // Method 2: Try using PowerShell
      try {
        console.log("Attempting Windows screenshot with PowerShell (Method 2)");
        const tempFile = path.join(this.tempDir, `ps-temp-${uuidv4()}.png`);

        // PowerShell command to take screenshot using .NET classes
        const psScript = `
        Add-Type -AssemblyName System.Windows.Forms,System.Drawing
        $screens = [System.Windows.Forms.Screen]::AllScreens
        $top = ($screens | ForEach-Object {$_.Bounds.Top} | Measure-Object -Minimum).Minimum
        $left = ($screens | ForEach-Object {$_.Bounds.Left} | Measure-Object -Minimum).Minimum
        $width = ($screens | ForEach-Object {$_.Bounds.Right} | Measure-Object -Maximum).Maximum
        $height = ($screens | ForEach-Object {$_.Bounds.Bottom} | Measure-Object -Maximum).Maximum
        $bounds = [System.Drawing.Rectangle]::FromLTRB($left, $top, $width, $height)
        $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
        $graphics = [System.Drawing.Graphics]::FromImage($bmp)
        $graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)
        $bmp.Save('${tempFile.replace(
          /\\/g,
          "\\\\"
        )}', [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bmp.Dispose()
        `;

        // Execute PowerShell
        await execFileAsync("powershell", [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          psScript,
        ]);

        // Check if file exists and read it
        if (fs.existsSync(tempFile)) {
          const buffer = await fs.promises.readFile(tempFile);
          console.log(
            `Method 2 successful, screenshot size: ${buffer.length} bytes`
          );

          // Cleanup
          try {
            await fs.promises.unlink(tempFile);
          } catch (err) {
            console.warn("Failed to clean up PowerShell temp file:", err);
          }

          return buffer;
        } else {
          throw new Error("PowerShell screenshot file not created");
        }
      } catch (psError) {
        console.warn("Windows PowerShell screenshot failed:", psError);

        // Method 3: Last resort - create a tiny placeholder image
        console.log(
          "All screenshot methods failed, creating placeholder image"
        );

        // Create a 1x1 transparent PNG as fallback
        const fallbackBuffer = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          "base64"
        );
        console.log("Created placeholder image as fallback");

        // Show the error but return a valid buffer so the app doesn't crash
        throw new Error(
          "Could not capture screenshot with any method. Please check your Windows security settings and try again."
        );
      }
    }
  }

  public async takeScreenshot(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string[]> {
    console.log("Taking screenshot in view:", this.view);
    hideMainWindow();

    const hideDelay = process.platform === "win32" ? 500 : 300;
    await new Promise((resolve) => setTimeout(resolve, hideDelay));

    const savedPaths: string[] = [];
    try {
      const screenshotBuffers = await this.captureCurrentDisplay();

      for (const screenshotBuffer of screenshotBuffers) {
        if (!screenshotBuffer || screenshotBuffer.length === 0) {
          continue;
        }

        let screenshotPath = "";
        if (this.view === "queue") {
          screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`);
          await fs.promises.writeFile(screenshotPath, screenshotBuffer);
          this.screenshotQueue.push(screenshotPath);
          while (this.screenshotQueue.length > this.MAX_SCREENSHOTS) {
            const removedPath = this.screenshotQueue.shift();
            if (removedPath) {
              try {
                await fs.promises.unlink(removedPath);
              } catch (error) {
                console.error("Error removing old screenshot:", error);
              }
            }
          }
        } else {
          screenshotPath = path.join(this.extraScreenshotDir, `${uuidv4()}.png`);
          await fs.promises.writeFile(screenshotPath, screenshotBuffer);
          this.extraScreenshotQueue.push(screenshotPath);
          while (this.extraScreenshotQueue.length > this.MAX_SCREENSHOTS) {
            const removedPath = this.extraScreenshotQueue.shift();
            if (removedPath) {
              try {
                await fs.promises.unlink(removedPath);
              } catch (error) {
                console.error("Error removing old screenshot:", error);
              }
            }
          }
        }
        savedPaths.push(screenshotPath);
      }

      if (savedPaths.length === 0) {
        throw new Error("Screenshot capture returned empty buffer");
      }
    } catch (error) {
      console.error("Screenshot error:", error);
      throw error;
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 200));
      showMainWindow();
    }

    return savedPaths;
  }

  public async getImagePreview(filepath: string): Promise<string> {
    try {
      if (!fs.existsSync(filepath)) {
        console.error(`Image file not found: ${filepath}`);
        return "";
      }

      const data = await fs.promises.readFile(filepath);
      return `data:image/png;base64,${data.toString("base64")}`;
    } catch (error) {
      console.error("Error reading image:", error);
      return "";
    }
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (fs.existsSync(path)) {
        await fs.promises.unlink(path);
      }

      if (this.view === "queue") {
        this.screenshotQueue = this.screenshotQueue.filter(
          (filePath) => filePath !== path
        );
      } else {
        this.extraScreenshotQueue = this.extraScreenshotQueue.filter(
          (filePath) => filePath !== path
        );
      }
      return { success: true };
    } catch (error) {
      console.error("Error deleting file:", error);
      return { success: false, error: error.message };
    }
  }

  public clearExtraScreenshotQueue(): void {
    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      if (fs.existsSync(screenshotPath)) {
        fs.unlink(screenshotPath, (err) => {
          if (err)
            console.error(
              `Error deleting extra screenshot at ${screenshotPath}:`,
              err
            );
        });
      }
    });
    this.extraScreenshotQueue = [];
  }
}
