param(
    [string]$ProjectPath = ".\Excel_VBA_AdvancedUtils",
    [switch]$CreateExcelFile = $false,
    [switch]$Verbose = $false
)

# Clean up the ProjectPath parameter by removing quotes
$ProjectPath = $ProjectPath.Trim('"')

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "======================================" "Cyan"
Write-ColorOutput "VBA Module Import Script" "Cyan"
Write-ColorOutput "for Excel VBA AdvancedUtils Project" "Cyan"
Write-ColorOutput "======================================" "Cyan"

$ExcelFilePath = Join-Path $ProjectPath "AdvancedUtils_Manager.xlsm"
$SourceFolder = Join-Path $ProjectPath "src"

Write-ColorOutput "Project Path: $ProjectPath" "Yellow"
Write-ColorOutput "Excel File: $ExcelFilePath" "Yellow"
Write-ColorOutput "Source Folder: $SourceFolder" "Yellow"

$ModuleFiles = @(
    "Module_Utility.bas",
    "Module_Main.bas",
    "Module_DuplicateDetector.bas",
    "Module_DiskAnalyzer.bas",
    "Module_FileOrganizer.bas",
    "Module_SystemInfo.bas"
)

if (-not (Test-Path $SourceFolder)) {
    Write-ColorOutput "Error: Source folder not found: $SourceFolder" "Red"
    exit 1
}

Write-ColorOutput "`n[Checking file existence]" "Green"
$missingFiles = @()
foreach ($file in $ModuleFiles) {
    $fullPath = Join-Path $SourceFolder $file
    if (Test-Path $fullPath) {
        Write-ColorOutput "V $file" "Green"
    } else {
        Write-ColorOutput "X $file (Not found)" "Red"
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-ColorOutput "`nError: Missing files:" "Red"
    $missingFiles | ForEach-Object { Write-ColorOutput "  - $_" "Red" }
    exit 1
}

if ($CreateExcelFile) {
    Write-ColorOutput "`n[Creating Excel file]" "Green"
    try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        
        $workbook = $excel.Workbooks.Add()
        $workbook.SaveAs($ExcelFilePath, 52)
        $workbook.Close()
        $excel.Quit()
        
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        
        Write-ColorOutput "V Excel file created: $ExcelFilePath" "Green"
    }
    catch {
        Write-ColorOutput "Error creating Excel file: $($_.Exception.Message)" "Red"
        exit 1
    }
}

if (-not (Test-Path $ExcelFilePath)) {
    Write-ColorOutput "`nError: Excel file not found: $ExcelFilePath" "Red"
    Write-ColorOutput "Use the -CreateExcelFile switch to create it." "Yellow"
    exit 1
}

Write-ColorOutput "`n[Starting VBA module import]" "Green"

$excel = $null
$workbook = $null

try {
    Write-ColorOutput "Starting Excel application..." "Yellow"
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    
    Write-ColorOutput "Opening workbook..." "Yellow"
    $workbook = $excel.Workbooks.Open($ExcelFilePath)
    
    $vbaProject = $workbook.VBProject
    Write-ColorOutput "VBA Project Name: $($vbaProject.Name)" "Cyan"
    
    Write-ColorOutput "`n[Removing existing modules]" "Yellow"
    $deletedCount = 0
    foreach ($moduleFile in $ModuleFiles) {
        $moduleName = [System.IO.Path]::GetFileNameWithoutExtension($moduleFile)
        try {
            $existingModule = $vbaProject.VBComponents | Where-Object { $_.Name -eq $moduleName -and $_.Type -eq 1 }
            if ($existingModule) {
                $vbaProject.VBComponents.Remove($existingModule)
                Write-ColorOutput "- Removed: $moduleName" "Yellow"
                $deletedCount++
            }
        }
        catch {
            if ($Verbose) {
                Write-ColorOutput "- Skip removal: $moduleName" "Gray"
            }
        }
    }
    Write-ColorOutput "Finished removing modules ($deletedCount removed)." "Green"
    
    Write-ColorOutput "`n[Importing modules]" "Green"
    $importedCount = 0
    $failedModules = @()
    
    foreach ($file in $ModuleFiles) {
        $fullPath = Join-Path $SourceFolder $file
        $moduleName = [System.IO.Path]::GetFileNameWithoutExtension($file)
        
        try {
            Write-ColorOutput "Importing: $file" "Yellow"
            $vbaProject.VBComponents.Import($fullPath)
            Write-ColorOutput "V Imported: $moduleName" "Green"
            $importedCount++
            Start-Sleep -Milliseconds 300
        }
        catch {
            Write-ColorOutput "X Import failed: $file" "Red"
            Write-ColorOutput "  Error: $($_.Exception.Message)" "Red"
            $failedModules += $file
        }
    }
    
    Write-ColorOutput "`n[Verifying import]" "Green"
    $finalModules = @()
    foreach ($component in $vbaProject.VBComponents) {
        if ($component.Type -eq 1) { 
            $finalModules += $component.Name
            Write-ColorOutput "V Verified module: $($component.Name)" "Green"
        }
    }
    
    Write-ColorOutput "`nSaving workbook..." "Yellow"
    $workbook.Save()
    
    Write-ColorOutput "`n======================================" "Cyan"
    Write-ColorOutput "Import Complete!" "Green"
    Write-ColorOutput "======================================" "Cyan"
    Write-ColorOutput "Modules imported: $importedCount / $($ModuleFiles.Count)" "White"
    Write-ColorOutput "Current modules:" "White"
    $finalModules | ForEach-Object { Write-ColorOutput "  - $_" "Cyan" }
    
    if ($importedCount -eq $ModuleFiles.Count) {
        Write-ColorOutput "`nAll modules imported successfully!" "Green"
        Write-ColorOutput "`nNext steps:" "Yellow"
        Write-ColorOutput "1. Open Excel file: $ExcelFilePath" "White"
        Write-ColorOutput "2. Create UserForm_Simple manually" "White"
        Write-ColorOutput "3. Run 'Call ShowMenu()' in the Immediate Window" "White"
    } else {
        Write-ColorOutput "`nImport errors occurred." "Yellow"
        Write-ColorOutput "Failed modules:" "Red"
        $failedModules | ForEach-Object { Write-ColorOutput "  - $_" "Red" }
    }
}
catch {
    Write-ColorOutput "`nError: VBA module import failed." "Red"
    Write-ColorOutput "Details: $($_.Exception.Message)" "Red"
    Write-ColorOutput "`nPossible causes:" "Yellow"
    Write-ColorOutput "- Excel macro security settings" "White"
    Write-ColorOutput "- 'Trust access to the VBA project object model' is disabled" "White"
}
finally {
    if ($workbook) {
        try {
            $workbook.Close($false)
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
        } catch { }
    }
    if ($excel) {
        try {
            $excel.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        } catch { }
    }
    
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    Write-ColorOutput "`nResource cleanup complete." "Gray"
}

Write-ColorOutput "`n======================================" "Cyan"