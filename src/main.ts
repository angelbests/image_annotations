import { createApp } from "vue";
import "./styles.css";
import App from "./App.vue";
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createPinia } from "pinia";
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
const app = createApp(App)
app.use(ElementPlus)
app.use(createPinia().use(piniaPluginPersistedstate))
app.mount('#app')
