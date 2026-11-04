@echo off
REM Sets a local JAVA_HOME and clears stale React Native native build output
REM before invoking Gradle. The generated CMake cache can keep pointing at an
REM invalid fbjni prefab path after dependency/cache refreshes.
setlocal
set "JAVA_HOME=C:\Users\pisti\.gradle\jdks\eclipse_adoptium-21-amd64-windows.2"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0\.."

set "APP_ROOT=%CD%"
set "APP_CXX_DIR=%APP_ROOT%\android\app\.cxx"
set "APP_BUILD_DIR=%APP_ROOT%\android\app\build"

if exist "%APP_CXX_DIR%" (
  echo Removing stale CMake native build cache: %APP_CXX_DIR%
  rmdir /S /Q "%APP_CXX_DIR%"
)

if exist "%APP_BUILD_DIR%" (
  echo Removing stale app build output: %APP_BUILD_DIR%
  rmdir /S /Q "%APP_BUILD_DIR%"
)

echo Using JAVA_HOME=%JAVA_HOME%
call ".\android\gradlew.bat" %*
endlocal
