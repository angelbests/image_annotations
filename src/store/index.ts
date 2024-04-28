import { defineStore } from "pinia";

interface imgType {
    httpsrc:string
    path:string,
    name:string,
    bool:boolean
}

export const containersStore = defineStore("containers",{
    state(){
        return {
            dirpath:"",
            images:[] as imgType[],
            imagessearch:[] as imgType[],
            image:"",
            imageIndex:0
        }
    },
    persist: true,
})