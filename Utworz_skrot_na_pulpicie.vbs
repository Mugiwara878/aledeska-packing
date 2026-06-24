' Skrypt tworzy skrot na pulpicie z ikona paczki
' Uruchom ten plik raz po rozpakowaniu aplikacji

Dim oShell, oLink, sFolder, sTarget

oShell  = CreateObject("WScript.Shell")
sFolder = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sTarget = sFolder & "\Uruchom.bat"

' skrot na pulpicie
oLink           = oShell.CreateShortcut(oShell.SpecialFolders("Desktop") & "\Asystent Pakowania.lnk")
oLink.TargetPath        = sTarget
oLink.WorkingDirectory  = sFolder
oLink.IconLocation      = sFolder & "\icon.ico"
oLink.Description       = "Asystent Pakowania - aledeska.pl"
oLink.Save()

MsgBox "Skrot 'Asystent Pakowania' zostal utworzony na pulpicie.", 64, "Gotowe"
