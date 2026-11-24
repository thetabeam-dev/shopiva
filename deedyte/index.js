/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerRootComponent } from 'expo';
import { registerFcmBackgroundHandler } from './src/utils/firebaseTokenReqConfig';

// Required: must run outside the React tree, before the app mounts.
registerFcmBackgroundHandler();
registerRootComponent(App);
// Native hosts look up "deedyte"; Expo's registerRootComponent registers "main".
AppRegistry.registerComponent(appName, () => App);
