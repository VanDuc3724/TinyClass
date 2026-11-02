param([switch]$GoogleMock)
$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskEnvironment = [System.IO.File]::ReadAllText((Join-Path $taskRoot '.env'))
$taskPassword = [regex]::Match($taskEnvironment, '(?m)^TINYCLASS_TEST_DB_PASSWORD=([^\r\n]+)').Groups[1].Value
$taskPort = [regex]::Match($taskEnvironment, '(?m)^TINYCLASS_TEST_DB_PORT=([0-9]+)').Groups[1].Value
if (-not $taskPassword) { throw 'Initialize .env before running E2E tests.' }
if (-not $taskPort) { $taskPort = '55433' }
$taskArtifact = Join-Path $taskRoot 'Backend/target/backend-0.0.1-SNAPSHOT.jar'
if (-not (Test-Path -LiteralPath $taskArtifact)) { throw 'Build Backend with mvnw.cmd verify before E2E tests.' }

# This reset is deliberately restricted to the dedicated Compose test service/database.
Push-Location $taskRoot
try {
    $taskDatabase = & docker compose --profile test exec -T postgres-test psql -U tinyclass_test -d tinyclass_test -tAc 'SELECT current_database()'
    if ($LASTEXITCODE -ne 0 -or "$taskDatabase".Trim() -ne 'tinyclass_test') { throw 'Dedicated test database is unavailable.' }
    $taskHasUsers = & docker compose --profile test exec -T postgres-test psql -U tinyclass_test -d tinyclass_test -tAc "SELECT to_regclass('public.users') IS NOT NULL"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the dedicated test database.' }
    # A recreated tmpfs database is empty; the application will migrate it on startup.
    if ("$taskHasUsers".Trim() -eq 't') {
        & docker compose --profile test exec -T postgres-test psql -U tinyclass_test -d tinyclass_test -v ON_ERROR_STOP=1 -c 'SET client_min_messages = warning; TRUNCATE users, audit_events CASCADE'
        if ($LASTEXITCODE -ne 0) { throw 'Cannot reset the dedicated test database.' }
    }
} finally { Pop-Location }

$env:TINYCLASS_DATABASE_URL = "jdbc:postgresql://127.0.0.1:$taskPort/tinyclass_test"
$env:TINYCLASS_DATABASE_USERNAME = 'tinyclass_test'
$env:TINYCLASS_DATABASE_PASSWORD = $taskPassword
$env:SPRING_DATASOURCE_URL = $env:TINYCLASS_DATABASE_URL
$env:SPRING_DATASOURCE_USERNAME = 'tinyclass_test'
$env:SPRING_DATASOURCE_PASSWORD = $taskPassword
$env:SPRING_PROFILES_ACTIVE = 'local'
$env:TINYCLASS_SETUP_KEY = 'e2e-only-setup-key-0123456789-abcdef'
$env:TINYCLASS_SERVER_PORT = '18080'
$env:TINYCLASS_PUBLIC_URL = 'http://127.0.0.1:5174'
$env:TINYCLASS_MAIL_PORT = '11026'
$env:SPRING_MAIL_HOST = '127.0.0.1'
$env:SPRING_MAIL_PORT = '11026'
$env:TINYCLASS_MAIL_ENABLED = 'true'
$env:TINYCLASS_MAIL_COOLDOWN_SECONDS = '0'
$env:TINYCLASS_AUTH_ATTEMPT_LIMIT = '200'
$env:TINYCLASS_UPLOAD_ROOT = Join-Path $taskRoot '.local/e2e-uploads'
Push-Location (Join-Path $taskRoot 'Backend')
try {
    if ($GoogleMock) {
        $env:SPRING_PROFILES_ACTIVE = 'local,oauth-test'
        & .\mvnw.cmd -B spring-boot:test-run '-Dspring-boot.run.main-class=com.tinyclass.support.OAuthE2EApplication'
    } else { & java -jar $taskArtifact --spring.profiles.active=local }
    exit $LASTEXITCODE
}
finally { Pop-Location }
