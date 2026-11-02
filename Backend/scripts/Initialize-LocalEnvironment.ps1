$ErrorActionPreference = 'Stop'
$taskEnvironmentPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../.env'))

function Add-TeacherSetupKey {
    $taskExisting = [System.IO.File]::ReadAllText($taskEnvironmentPath)
    if ($taskExisting -match '(?m)^TINYCLASS_SETUP_KEY=\S+\s*$') { return }
    $taskKeyRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $taskKeyBytes = New-Object byte[] 32
        $taskKeyRandom.GetBytes($taskKeyBytes)
        $taskKey = [System.BitConverter]::ToString($taskKeyBytes).Replace('-', '').ToLowerInvariant()
        $taskKeyLine = "TINYCLASS_SETUP_KEY=$taskKey"
        if ($taskExisting -match '(?m)^TINYCLASS_SETUP_KEY=.*$') {
            $taskExisting = [regex]::Replace($taskExisting, '(?m)^TINYCLASS_SETUP_KEY=.*$', $taskKeyLine)
        } else {
            $taskExisting = $taskExisting.TrimEnd() + [Environment]::NewLine + $taskKeyLine + [Environment]::NewLine
        }
        [System.IO.File]::WriteAllText($taskEnvironmentPath, $taskExisting, (New-Object System.Text.UTF8Encoding($false)))
        Write-Output 'Initialized the private teacher setup key.'
    } finally { $taskKeyRandom.Dispose() }
}

if (Test-Path -LiteralPath $taskEnvironmentPath) {
    Add-TeacherSetupKey
    Write-Output "Using existing local environment: $taskEnvironmentPath"
    exit 0
}

$taskRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $taskDatabaseBytes = New-Object byte[] 32
    $taskTestDatabaseBytes = New-Object byte[] 32
    $taskRandom.GetBytes($taskDatabaseBytes)
    $taskRandom.GetBytes($taskTestDatabaseBytes)
    $taskDatabasePassword = [System.BitConverter]::ToString($taskDatabaseBytes).Replace('-', '').ToLowerInvariant()
    $taskTestDatabasePassword = [System.BitConverter]::ToString($taskTestDatabaseBytes).Replace('-', '').ToLowerInvariant()

    $taskEnvironmentContent = @(
        'TINYCLASS_DB_NAME=tinyclass'
        'TINYCLASS_DB_USER=tinyclass'
        "TINYCLASS_DB_PASSWORD=$taskDatabasePassword"
        'TINYCLASS_DB_PORT=55432'
        "TINYCLASS_TEST_DB_PASSWORD=$taskTestDatabasePassword"
        'TINYCLASS_TEST_DB_PORT=55433'
    ) -join [Environment]::NewLine

    $taskEncoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($taskEnvironmentPath, $taskEnvironmentContent + [Environment]::NewLine, $taskEncoding)
    Add-TeacherSetupKey
    Write-Output "Created local environment: $taskEnvironmentPath"
} finally {
    $taskRandom.Dispose()
}
