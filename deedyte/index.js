/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerFcmBackgroundHandler } from './src/utils/firebaseTokenReqConfig';

// Required: must run outside the React tree, before the app mounts.
registerFcmBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
