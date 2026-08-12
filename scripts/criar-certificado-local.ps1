$ErrorActionPreference = 'Stop'
$certDir = Join-Path $PSScriptRoot '..\certs'
$pfxPath = Join-Path $certDir 'localhost.pfx'
New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$root = Get-ChildItem 'Cert:\CurrentUser\My' | Where-Object { $_.Subject -eq 'CN=Inova Work Local Development CA' } | Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $root) {
  $root = New-SelfSignedCertificate -Type Custom -Subject 'CN=Inova Work Local Development CA' -KeyUsage CertSign -KeyExportPolicy Exportable -KeyLength 2048 -HashAlgorithm SHA256 -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(5)
  $rootCer = Join-Path $env:TEMP 'inova-work-local-ca.cer'
  Export-Certificate -Cert $root -FilePath $rootCer | Out-Null
  Import-Certificate -FilePath $rootCer -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
  Remove-Item -LiteralPath $rootCer -Force
}

$leaf = New-SelfSignedCertificate -Type SSLServerAuthentication -Subject 'CN=localhost' -DnsName 'localhost' -KeyUsage DigitalSignature,KeyEncipherment -KeyExportPolicy Exportable -KeyLength 2048 -HashAlgorithm SHA256 -CertStoreLocation 'Cert:\CurrentUser\My' -Signer $root -NotAfter (Get-Date).AddYears(2)
$password = ConvertTo-SecureString -String 'inova-work-local' -Force -AsPlainText
Export-PfxCertificate -Cert $leaf -FilePath $pfxPath -Password $password -Force | Out-Null
Write-Host "Certificado renovado: $($leaf.Thumbprint)"
Write-Host 'Execute npm start e abra https://localhost:3000'
