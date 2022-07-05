import React, { useState, useEffect, useContext } from "react";
import logo from './logo.svg';
import './App.css';
//import Wallet from "@harmonicpool/cardano-wallet-interface";
import Wallet from "./cardano-wallet-interface";
import {NamiWalletApi} from "./nami-wallet-api/src/index";

const App = () => {
  const sendAmount = async () => {
    let Nami = await NamiWalletApi(
      window.cardano.yoroi, //nami wallet object
      "testnetL6w9rku7eJqr30BTxoCulZMAFNw3d05k"
    )
    
    let address = await Nami.getAddress()
    console.log("address",address)

    let test1  =  await Nami.send({
      address: "addr_test1qzlrvwz2vyl4etjkg4xka4w6a2rpqer6evcx0rf490hzu6y743qcltgzfzc80s5mrpecvszqklxj77rdwm0ylyng7wfq0uqvrt",
      amount: 1000
  })
  console.log("test1",test1)


  }
  const YoroiWalletApi = async () => {
    let Nami = await NamiWalletApi(
      window.cardano.yoroi, //nami wallet object
      "testnetQjfb7JSfJ6WymUvgqIJFOUqvE7O2jXs5"
    )
    
    let address = await Nami.getAddress()
    console.log("address",address)

 
     
/*    let txHash = await Nami.delegate({
          //poolId: "pool6ff051a96156919654a93f151670fa4b4d10fa61626ddcbeafa5bd71"
          //poolId:"eb7832cb137b6d20ee2c3f4892d4938a734326ca18122f0d21e5f587"
          poolId:"d5b1ac5ab8feee85749675ec4dcc4a206d4a938cb3d665c43ad8dcfa"
      })  */
      let txHash = await Nami.olddelegate({
        //poolId: "pool6ff051a96156919654a93f151670fa4b4d10fa61626ddcbeafa5bd71"
        //poolId:"eb7832cb137b6d20ee2c3f4892d4938a734326ca18122f0d21e5f587"
        //poolId:"d5b1ac5ab8feee85749675ec4dcc4a206d4a938cb3d665c43ad8dcfa"
        poolId:"d5b1ac5ab8feee85749675ec4dcc4a206d4a938cb3d665c43ad8dcfa"
        
    }) 

      console.log("txHash",txHash)
     
  }  

  //numi wallet
   const numiwalletconnect = async () => {
    let Nami = await NamiWalletApi(
      window.cardano.yoroi, //nami wallet object
      "testnetbc9CI86fZtgVTuBb3H36cNdH4L1KEAyF"
    )
    
    let address = await Nami.getAddress() 
    
    console.log("address",address)
     
/*    let txHash = await Nami.delegate({
          //poolId: "pool6ff051a96156919654a93f151670fa4b4d10fa61626ddcbeafa5bd71"
          //poolId:"eb7832cb137b6d20ee2c3f4892d4938a734326ca18122f0d21e5f587"
          poolId:"d5b1ac5ab8feee85749675ec4dcc4a206d4a938cb3d665c43ad8dcfa"
      })  */
      let txHash = await Nami.olddelegate({
        //poolId: "pool6ff051a96156919654a93f151670fa4b4d10fa61626ddcbeafa5bd71"
        //poolId:"eb7832cb137b6d20ee2c3f4892d4938a734326ca18122f0d21e5f587"
        poolId:"eb7832cb137b6d20ee2c3f4892d4938a734326ca18122f0d21e5f587"
    }) 

      console.log("txHash",txHash)
     
  }  
 
     
  // wallet interface
const testFun1 = async () => {
       
    Wallet.setBlockfrost("testnetbc9CI86fZtgVTuBb3H36cNdH4L1KEAyF");
    if(Wallet.has(Wallet.Names.Nami)) {
       
      //await Wallet.enable(Wallet.Names.Nami)
    
      //const poolid = "pooleb7832cb137b6d20ee2c3f4892d4938a734326ca18122f0d21e5f587";
      //const poolid = "pool6ff051a96156919654a93f151670fa4b4d10fa61626ddcbeafa5bd71";
      const poolid = "poold5b1ac5ab8feee85749675ec4dcc4a206d4a938cb3d665c43ad8dcfa";
      //const poolid = "pool5685f37bca393c683cf03e428280312c6c4ea485188672a2a0b3195c";
      
      const blockfrost_project_id = "testnetbc9CI86fZtgVTuBb3H36cNdH4L1KEAyF";
      
      if(!await Wallet.isEnabled( Wallet.Names.Nami)){
          await Wallet.enable( Wallet.Names.Nami )
          .then(async () => {
                console.log("if thene",await Wallet.Nami.getCurrentUserDelegation())
               // Wallet.Nami.delegateTo(poolid,blockfrost_project_id);  
              }
          );
      }
      else
      {
        await Wallet.enable( Wallet.Names.Nami )
          .then(async () => {
                //console.log("if thene",await Wallet.Nami.getCurrentUserDelegation())
                Wallet.Nami.delegateTo(poolid,blockfrost_project_id);  
              }
          );
          //Wallet.Nami.delegateTo(poolid); 
      }
    }
    
}  

  useEffect( () => {
   
  })
  return (
    <div className="App">
      <header className="App-header">
         Test
         <button 
         style={{width:"20%",height:"50px"}}
              onClick={() => YoroiWalletApi()}>
                YoroiWalletApi
              </button>
              <br></br>

         <button 
         style={{width:"20%",height:"50px"}}
              onClick={() => numiwalletconnect()}>
                NamiWalletApi
              </button>
              <br></br>
              <button 
                  style={{width:"20%",height:"50px"}}
              onClick={() => testFun1()}>
                Wallet
              </button>
              <br></br>
              <button 
                  style={{width:"20%",height:"50px"}}
              onClick={() => sendAmount()}>
                Send Amount
              </button>
         </header>
    </div>
  );
}

export default App;
