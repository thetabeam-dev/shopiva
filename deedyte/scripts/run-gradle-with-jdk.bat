@echo off
REM Sets a local JAVA_HOME for this build and runs the Android gradle wrapper with passed args.
setlocal
set "JAVA_HOME=C:\Users\pisti\.gradle\jdks\eclipse_adoptium-21-amd64-windows.2"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0\.."
echo Using JAVA_HOME=%JAVA_HOME%
".\android\gradlew.bat" %*
endlocal
