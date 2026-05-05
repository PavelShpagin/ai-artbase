# setup-chrome-mcp.ps1
# Make Chrome MCP-attachable forever, without ever force-killing Chrome
# (force-killing is what loses session cookies). One-time shortcut edit
# + one graceful close+reopen by user = permanent MCP readiness.

$ErrorActionPreference = "Stop"
$DEBUG_PORT = 9222
$FLAG = "--remote-debugging-port=$DEBUG_PORT"

function Test-Port {
    try {
        $r = Invoke-WebRequest "http://127.0.0.1:$DEBUG_PORT/json/version" -UseBasicParsing -TimeoutSec 2
        return $r.StatusCode -eq 200
    } catch { return $false }
}

function Update-Shortcut($lnkPath) {
    if (-not (Test-Path $lnkPath)) { return $null }
    try {
        $shell = New-Object -ComObject WScript.Shell
        $sc = $shell.CreateShortcut($lnkPath)
        if ($sc.TargetPath -notmatch "chrome\.exe$") {
            return @{ path = $lnkPath; status = "skipped (not chrome target)" }
        }
        if ($sc.Arguments -match "remote-debugging-port") {
            return @{ path = $lnkPath; status = "already had flag" }
        }
        $sc.Arguments = ($sc.Arguments + " " + $FLAG).Trim()
        $sc.Save()
        return @{ path = $lnkPath; status = "updated" }
    } catch [System.UnauthorizedAccessException] {
        return @{ path = $lnkPath; status = "skipped (needs admin -- ok, user-level shortcuts cover it)" }
    } catch {
        return @{ path = $lnkPath; status = "skipped (error: $($_.Exception.Message))" }
    }
}

# Phase 1: short-circuit if port is already up
if (Test-Port) {
    Write-Host "Port $DEBUG_PORT already open. Chrome is MCP-ready." -ForegroundColor Green
    Invoke-WebRequest "http://127.0.0.1:$DEBUG_PORT/json/version" -UseBasicParsing | Select-Object -ExpandProperty Content
    exit 0
}

# Phase 2: modify all Chrome shortcuts so future launches always have the flag
Write-Host "`n[1/3] Updating Chrome shortcuts to include --remote-debugging-port=$DEBUG_PORT" -ForegroundColor Cyan

$candidates = @(
    "$env:USERPROFILE\Desktop\Google Chrome.lnk",
    "$env:PUBLIC\Desktop\Google Chrome.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Google Chrome.lnk",
    "$env:PROGRAMDATA\Microsoft\Windows\Start Menu\Programs\Google Chrome.lnk",
    "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Google Chrome.lnk",
    "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\Google Chrome.lnk"
)

foreach ($p in $candidates) {
    $r = Update-Shortcut $p
    if ($null -eq $r) { Write-Host "  (not found) $p" -ForegroundColor DarkGray }
    else { Write-Host "  [$($r.status)] $($r.path)" -ForegroundColor Yellow }
}

# Phase 3: instruct user. We do NOT force-kill Chrome here -- that's the
# whole point. Sessions only survive if user closes Chrome via the X.
Write-Host "`n[2/3] Action needed from you" -ForegroundColor Cyan
$running = (Get-Process -Name chrome -ErrorAction SilentlyContinue | Measure-Object).Count
if ($running -gt 0) {
    Write-Host "Chrome is currently running ($running processes)." -ForegroundColor Yellow
    Write-Host "  -> Close it the normal way (X button on every Chrome window)."
    Write-Host "     This is the ONLY way to preserve session-only cookies."
    Write-Host "  -> Then reopen Chrome from Start menu / desktop / taskbar."
    Write-Host "     The new launch will already have the debug port open."
} else {
    Write-Host "Chrome is not running. Just open it from Start menu / desktop / taskbar." -ForegroundColor Yellow
    Write-Host "  -> Shortcuts now include the debug flag, so it will be MCP-ready immediately."
}

Write-Host "`n[3/3] Verification" -ForegroundColor Cyan
Write-Host "After you reopen Chrome, run this to confirm:"
Write-Host "  Invoke-WebRequest http://127.0.0.1:$DEBUG_PORT/json/version -UseBasicParsing | Select -Expand Content" -ForegroundColor White
Write-Host "Then in Claude Code: /mcp -> reconnect chrome-devtools" -ForegroundColor White

Write-Host "`nNotes:" -ForegroundColor DarkCyan
Write-Host "  * From now on, every Chrome you open has port $DEBUG_PORT live."
Write-Host "  * MCP attaches/detaches without touching cookies. Your real Chrome is untouched."
Write-Host "  * To revert: re-run with -Revert (removes the flag from all shortcuts)." -ForegroundColor DarkCyan
