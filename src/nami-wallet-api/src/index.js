import { MultiAsset, TransactionOutputs, TransactionUnspentOutput,  Address,
    Value } from '@emurgo/cardano-serialization-lib-asmjs'
import { Buffer } from 'buffer'
import { exit } from 'process'
const ERROR = {
    FAILED_PROTOCOL_PARAMETER: 'Couldnt fetch protocol parameters from blockfrost',
    TX_TOO_BIG: 'Transaction too big'
}

     
export async function NamiWalletApi(NamiWalletObject, blockfrostApiKey, serializationLib )  {
    const S = serializationLib || await import('@emurgo/cardano-serialization-lib-asmjs')
    
    const Buffer = (await import('buffer')).Buffer
    const Nami = NamiWalletObject
     
    
    const CoinSelection = (await import('./coinSelection')).default

    async function isEnabled() {
        return await Nami.isEnabled()  
    }

    async function enable() {
         
            try {
               return await Nami.enable()
            } catch (error) {
                throw error
            }
        
    }

    async function getAddress() {
        return Address.from_bytes(
            Buffer.from(
                await getAddressHex(),
                'hex'
            )
        ).to_bech32()
    }


    async function getAddressHex() {
          let walletServer =await Nami.enable();
        return await walletServer.getChangeAddress()
    }
    
    async function getRewardAddress() {
        return S.RewardAddress.from_address(
            S.Address.from_bytes(
                Buffer.from(
                    await getRewardAddressHex(),
                    'hex'
                )
            )
        )?.to_address().to_bech32()
    }

    async function getRewardAddressHex()  {
        let walletServer =await Nami.enable();
        const raw = await walletServer.getRewardAddresses();
        const rawFirst = raw[0];
        return rawFirst
    }

    async function getNetworkId() {
        let networkId = await Nami.getNetworkId()
        return {
            id: networkId,
            network: networkId == 1 ? 'mainnet' : 'testnet'
        }
    }

    async function getUtxos()  {
        let Utxos = (await getUtxosHex()).map(u => S.TransactionUnspentOutput.from_bytes(
                Buffer.from(
                    u, 
                    'hex'
                )
            )
        )
        let UTXOS = []
        for(let utxo of Utxos){
            let assets = _utxoToAssets(utxo)

            UTXOS.push({
                txHash: Buffer.from(
                    utxo.input().transaction_id().to_bytes(),
                    'hex'
                  ).toString('hex'),
                txId: utxo.input().index(),
                amount: assets
            })
        }
        return UTXOS
    }

    async function getAssets()  {
        let Utxos = await getUtxos()
        let AssetsRaw   = []
        Utxos.forEach(u => {
            AssetsRaw.push(...u.amount.filter(a => a.unit != 'lovelace'))
        })
        let AssetsMap  = {}
        
        for(let k of AssetsRaw){
            let quantity = parseInt(k.quantity)
            if(!AssetsMap[k.unit]) AssetsMap[k.unit] = 0
            AssetsMap[k.unit] += quantity
        }
        return Object.keys(AssetsMap).map(k => ({unit: k, quantity: AssetsMap[k].toString()}))
    }

    

    async function getUtxosHex()  {
        let walletServer =await Nami.enable();
        return await walletServer.getUtxos()
    }

    
    async function oldsend({address, amount = 0, assets = [], metadata = null, metadataLabel = '721'} )  {
        
        let protocolParameter = await _getProtocolParameter()
        let utxos = (await getUtxosHex()).map(u => S.TransactionUnspentOutput.from_bytes(
            Buffer.from(
                u,
                'hex'
            )
        ))
       

        let lovelace = Math.floor(parseInt(amount)  * 1000000).toString()

        let ReceiveAddress = address

        let multiAsset = _makeMultiAsset(assets)

    
        let outputValue = S.Value.new(
            S.BigNum.from_str(lovelace)
        )
           
        if(assets.length > 0)outputValue.set_multiasset(multiAsset)

        let minAda = S.min_ada_required(
            outputValue, 
            S.BigNum.from_str(protocolParameter.minUtxo || "1000000")
        )
        if(S.BigNum.from_str(lovelace).compare(minAda) < 0)outputValue.set_coin(minAda)


        let outputs = S.TransactionOutputs.new()
        outputs.add(
            S.TransactionOutput.new(
                S.Address.from_bech32(ReceiveAddress),
                outputValue
            )
        )
  
        let RawTransaction = _txBuilder({
            PaymentAddress: PaymentAddress,
            Utxos: utxos,
            Outputs: outputs,
            ProtocolParameter: protocolParameter,
            Metadata: metadata,
            MetadataLabel: metadataLabel,
            Delegation: null
        })
       
        return await _signSubmitTx(RawTransaction) 
    }

    async function send({address, amount = 0, assets = [], metadata = null, metadataLabel = '721'} )  {
        
        let protocolParameter = await _getProtocolParameter()
        let utxos = (await getUtxosHex()).map(u => S.TransactionUnspentOutput.from_bytes(
            Buffer.from(
                u,
                'hex'
            )
        ))
       

        let lovelace = Math.floor(parseInt(amount)  * 1000000).toString()

        let ReceiveAddress = address

        let multiAsset = _makeMultiAsset(assets)

    
        let outputValue = S.Value.new(
            S.BigNum.from_str(lovelace)
        )
           
        if(assets.length > 0)outputValue.set_multiasset(multiAsset)

     /*    let minAda = S.min_ada_required(
            outputValue, 
            S.BigNum.from_str(protocolParameter.minUtxo || "1000000")
        )
        if(S.BigNum.from_str(lovelace).compare(minAda) < 0)outputValue.set_coin(minAda) */


        let outputs = S.TransactionOutputs.new()
        outputs.add(
            S.TransactionOutput.new(
                S.Address.from_bech32(ReceiveAddress),
                outputValue
            )
        )

            // config
             const txConfig = S.TransactionBuilderConfigBuilder.new()
            
            .fee_algo(
            S.LinearFee.new(
                S.BigNum.from_str(protocolParameter.linearFee.minFeeA),
                S.BigNum.from_str(protocolParameter.linearFee.minFeeB)
            )
            )
            .pool_deposit(S.BigNum.from_str(protocolParameter.poolDeposit))
            .key_deposit(S.BigNum.from_str(protocolParameter.keyDeposit))
            .coins_per_utxo_word(S.BigNum.from_str('34482'))
            /* .max_tx_size(protocolParameter.maxTxSize)
            .max_value_size(protocolParameter.maxValSize) */
            .max_value_size(4000)
            .max_tx_size(8000)
            .prefer_pure_change(true)
            .build();

            console.log("txConfig",txConfig)

            // builder
            const txBuilder = S.TransactionBuilder.new(txConfig); 
            
            // outputs
            txBuilder.add_output(
            S.TransactionOutputBuilder.new()
            .with_address(S.Address.from_bech32(ReceiveAddress))
            .next()
            .with_value(S.Value.new(S.BigNum.from_str(lovelace)))
            .build()
            );

            // convert utxos from wallet connector
            const utxosFromWalletConnector = (await getUtxosHex()).map((utxo) =>
            S.TransactionUnspentOutput.from_bytes(Buffer.from(utxo, "hex"))
            );

            // create TransactionUnspentOutputs for 'add_inputs_from' function
            const utxoOutputs = S.TransactionUnspentOutputs.new();
            utxosFromWalletConnector.map((currentUtxo) => {
            utxoOutputs.add(currentUtxo);
            });

            // inputs with coin selection
            // 0 for LargestFirst, 1 RandomImprove 2,3 Mutli asset
            txBuilder.add_inputs_from(utxoOutputs, 0); 
            txBuilder.add_change_if_needed(S.Address.from_bech32(await getAddress()));

            const txBody = txBuilder.build();
            const transaction = S.Transaction.new(
                txBuilder.build(),
                S.TransactionWitnessSet.new()
            );

        
            /* 
            let walletServer = await Nami.enable();
            const witness = await walletServer.signTx(
            Buffer.from(transaction.to_bytes(), "hex").toString("hex")
            );

            const signedTx = S.Transaction.new(
            txBody,
            S.TransactionWitnessSet.from_bytes(Buffer.from(witness, "hex")),
            undefined // transaction metadata
            );

            const txHash = await walletServer.submitTx(
                Buffer.from(signedTx.to_bytes()).toString("hex")
            ); 
 */ 

        return await _signSubmitTx(transaction) 
           

    }
    
    async function _signSubmitTx(transactionRaw ) {
        let walletServer = await Nami.enable();

        let transaction = S.Transaction.from_bytes(transactionRaw)
        const witneses = await walletServer.signTx(
            Buffer.from(
                transaction.to_bytes()
            ).toString('hex')
        )

        const signedTx = S.Transaction.new(
            transaction.body(), 
            S.TransactionWitnessSet.from_bytes(
                Buffer.from(
                    witneses,
                    "hex"
                )
            ),
            transaction.auxiliary_data()
        )

        const txhash = await walletServer.submitTx(
            Buffer.from(
                signedTx.to_bytes()
            ).toString('hex')
        )
        return txhash

    }

    async function olddelegate({poolId, metadata = null, metadataLabel = '721'} ) {
      
        let protocolParameter = await _getProtocolParameter()
        console.log("protocolParameter",protocolParameter)
        let stakeKeyHash = S.RewardAddress.from_address(
            S.Address.from_bytes(
                Buffer.from(
                    await getRewardAddressHex(),
                    'hex'
                )
            )
        ).payment_cred().to_keyhash().to_bytes()

        let delegation = await getDelegation(await getRewardAddress())
        console.log("delegation",await getRewardAddress());

         async function getDelegation(rewardAddr) {
             
            let stake = await _blockfrostRequest(`/accounts/${rewardAddr}`) 
            if(!stake || stake.error || !stake.pool_id) return {}

            return {
                active: stake.active,
                rewards: stake.withdrawable_amount,
                poolId: stake.pool_id,
            }
        }

        let pool = await _blockfrostRequest(`/pools/${poolId}`)
        let poolHex = pool.hex

        let utxos = (await getUtxosHex()).map(u => S.TransactionUnspentOutput.from_bytes(Buffer.from(u, 'hex')))
        let PaymentAddress = await getAddress()

        let outputs = S.TransactionOutputs.new()
        outputs.add(
            S.TransactionOutput.new(
              S.Address.from_bech32(PaymentAddress),
              S.Value.new(
                  S.BigNum.from_str(protocolParameter.keyDeposit)
              )
            )
        )

        /*  let transaction = _txBuilder({
                PaymentAddress,
                Utxos: utxos,
                ProtocolParameter: protocolParameter,
                Outputs: outputs,
                Delegation: {
                    poolHex: poolHex,
                    stakeKeyHash: stakeKeyHash,
                    delegation: delegation
                },
                Metadata: metadata,
                MetadataLabel: metadataLabel
            }) */

            // config
             const txConfig = S.TransactionBuilderConfigBuilder.new()
            
            .fee_algo(
            S.LinearFee.new(
                S.BigNum.from_str(protocolParameter.linearFee.minFeeA),
                S.BigNum.from_str(protocolParameter.linearFee.minFeeB)
            )
            )
            .pool_deposit(S.BigNum.from_str(protocolParameter.poolDeposit))
            .key_deposit(S.BigNum.from_str(protocolParameter.keyDeposit))
            .coins_per_utxo_word(S.BigNum.from_str('34482'))
            /* .max_tx_size(protocolParameter.maxTxSize)
            .max_value_size(protocolParameter.maxValSize) */
            .max_value_size(4000)
            .max_tx_size(8000)
            .prefer_pure_change(true)
            .build();

            console.log("txConfig",txConfig)

            // builder
            const txBuilder = S.TransactionBuilder.new(txConfig); 
            

            // outputs
            txBuilder.add_output(
            S.TransactionOutputBuilder.new()
            .with_address(S.Address.from_bech32(PaymentAddress))
            //.with_address(S.Address.from_bech32("eb7832cb137b6d20ee2c3f4892d4938a734326ca18122f0d21e5f587"))
            .next()
            .with_value(S.Value.new(S.BigNum.from_str("999978")))
            .build()
            );

            // convert utxos from wallet connector
            const utxosFromWalletConnector = (await getUtxosHex()).map((utxo) =>
            S.TransactionUnspentOutput.from_bytes(Buffer.from(utxo, "hex"))
            );

            // create TransactionUnspentOutputs for 'add_inputs_from' function
            const utxoOutputs = S.TransactionUnspentOutputs.new();
            utxosFromWalletConnector.map((currentUtxo) => {
            utxoOutputs.add(currentUtxo);
            });

            // inputs with coin selection
            // 0 for LargestFirst, 1 RandomImprove 2,3 Mutli asset
            txBuilder.add_inputs_from(utxoOutputs, 0); 
            txBuilder.add_change_if_needed(S.Address.from_bech32(await getAddress()));

            const txBody = txBuilder.build();
            const transaction = S.Transaction.new(
                txBuilder.build(),
                S.TransactionWitnessSet.new()
            );

            let walletServer = await Nami.enable();

            const witness = await walletServer.signTx(
            Buffer.from(transaction.to_bytes(), "hex").toString("hex")
            );

            const signedTx = S.Transaction.new(
            txBody,
            S.TransactionWitnessSet.from_bytes(Buffer.from(witness, "hex")),
            undefined // transaction metadata
            );

            const txHash = await walletServer.submitTx(
                Buffer.from(signedTx.to_bytes()).toString("hex")
            ); 

            return txHash 

       /*  let txHash = await _signSubmitTx(transaction)
        return txHash   */
    }
    async function sendMultiple({recipients = [], metadata = null, metadataLabel = '721'})  {
        let PaymentAddress = await getAddress()

        let protocolParameter = await _getProtocolParameter()
        let utxos = (await getUtxosHex()).map(u => S.TransactionUnspentOutput.from_bytes(
            Buffer.from(
                u,
                'hex'
            )
        ))

        let outputs = S.TransactionOutputs.new()

        for (let recipient of recipients){
            let lovelace = Math.floor((recipient.amount || 0) * 1000000).toString()
            let ReceiveAddress = recipient.address
            let multiAsset = _makeMultiAsset(recipient.assets || [])

            let outputValue = S.Value.new(
                S.BigNum.from_str(lovelace)
            )
            
            if((recipient.assets || []).length > 0) outputValue.set_multiasset(multiAsset)

            let minAda = S.min_ada_required(
                outputValue, 
                S.BigNum.from_str(protocolParameter.minUtxo || "1000000")
            )
            if(S.BigNum.from_str(lovelace).compare(minAda) < 0)outputValue.set_coin(minAda)
    
            
            outputs.add(
                S.TransactionOutput.new(
                    S.Address.from_bech32(ReceiveAddress),
                    outputValue
                )
            )
        }

        let RawTransaction = _txBuilder({
            PaymentAddress: PaymentAddress,
            Utxos: utxos,
            Outputs: outputs,
            ProtocolParameter: protocolParameter,
            Metadata: metadata,
            MetadataLabel: metadataLabel,
            Delegation: null
        })

        return await _signSubmitTx(RawTransaction)
    }

    async function delegate({poolId, metadata = null, metadataLabel = '721'} ) {
      
          
        let protocolParameter = await _getProtocolParameter()
         
        console.log("protocolParameter",protocolParameter)
        let stakeKeyHash = S.RewardAddress.from_address(
            S.Address.from_bytes(
                Buffer.from(
                    await getRewardAddressHex(),
                    'hex'
                )
            )
        ).payment_cred().to_keyhash().to_bytes()

       let delegation = await getDelegation(await getRewardAddress())
        console.log("delegation",await getRewardAddress());

         async function getDelegation(rewardAddr) {
             
            let stake = await _blockfrostRequest(`/accounts/${rewardAddr}`) 
            if(!stake || stake.error || !stake.pool_id) return {}

            return {
                active: stake.active,
                rewards: stake.withdrawable_amount,
                poolId: stake.pool_id,
            }
        }

       let pool = await _blockfrostRequest(`/pools/${poolId}`)
        let poolHex = pool.hex

        let utxos = (await getUtxosHex()).map(u => S.TransactionUnspentOutput.from_bytes(Buffer.from(u, 'hex')))
        let PaymentAddress = await getAddress()

        let outputs = S.TransactionOutputs.new()
        outputs.add(
            S.TransactionOutput.new(
              S.Address.from_bech32(PaymentAddress),
              S.Value.new(
                  S.BigNum.from_str(protocolParameter.keyDeposit)
              )
            )
        )

         let transaction = _txBuilder({
            PaymentAddress,
            Utxos: utxos,
            ProtocolParameter: protocolParameter,
            Outputs: outputs,
            Delegation: {
                poolHex: poolHex,
                stakeKeyHash: stakeKeyHash,
                delegation: delegation
            },
            Metadata: metadata,
            MetadataLabel: metadataLabel
        })  

      // config
  
        let txHash = await _signSubmitTx(transaction)
        return txHash 
    }

    async function signData(string )  {
        let address = await getAddressHex()
        let coseSign1Hex = await Nami.signData(
            address,
            Buffer.from(
                string,
                "ascii"
            ).toString('hex')
        )
        return coseSign1Hex
    }

    //////////////////////////////////////////////////
    //Auxiliary

    function AsciiToBuffer(string ) {
        return Buffer.from(string, "ascii")
    }

    function HexToBuffer(string) {
        return Buffer.from(string, "hex")
    }

    function AsciiToHex(string) {
        return AsciiToBuffer(string).toString('hex')
    }

    function HexToAscii(string) {
        return HexToBuffer(string).toString("ascii")
    }

    function BufferToAscii(buffer) {
        return buffer.toString('ascii')
    }

    function BufferToHex(buffer) {
        return buffer.toString("hex")
    }

    

    //////////////////////////////////////////////////

    function _makeMultiAsset(assets ) {
        let AssetsMap = {}
        for(let asset of assets){
            let [policy, assetName] = asset.unit.split('.')
            let quantity = asset.quantity
            if(!Array.isArray(AssetsMap[policy])){
                AssetsMap[policy] = []
            }
            AssetsMap[policy].push({
                "unit": Buffer.from(assetName, 'ascii').toString('hex'), 
                "quantity": quantity
            })
            
        }
        let multiAsset = S.MultiAsset.new()
        for(const policy in AssetsMap){

            const ScriptHash = S.ScriptHash.from_bytes(
                Buffer.from(policy,'hex')
            )
            const Assets = S.Assets.new()
            
            const _assets = AssetsMap[policy]

            for(const asset of _assets){
                const AssetName = S.AssetName.new(Buffer.from(asset.unit,'hex'))
                const BigNum = S.BigNum.from_str(asset.quantity)
                
                Assets.insert(AssetName, BigNum)  
            }
            multiAsset.insert(ScriptHash, Assets)
        }
        return multiAsset
    }

    function _utxoToAssets(utxo) {
        let value  = utxo.output().amount()
        const assets = [];
        assets.push({ unit: 'lovelace', quantity: value.coin().to_str() });
        if (value.multiasset()) {
            const multiAssets = value.multiasset().keys();
            for (let j = 0; j < multiAssets.len(); j++) {
            const policy = multiAssets.get(j);
            const policyAssets = value.multiasset().get(policy);
            const assetNames = policyAssets.keys();
            for (let k = 0; k < assetNames.len(); k++) {
                const policyAsset = assetNames.get(k);
                const quantity = policyAssets.get(policyAsset);
                const asset =
                    Buffer.from(
                        policy.to_bytes()
                    ).toString('hex') + "." +
                    Buffer.from(
                        policyAsset.name()
                    ).toString('ascii')


                assets.push({
                    unit: asset,
                    quantity: quantity.to_str(),
                });
            }
            }
        }
        return assets;
    }

    function _txBuilder({PaymentAddress, Utxos, Outputs, ProtocolParameter, Metadata = null, MetadataLabel = '721', Delegation = null})  {
        const MULTIASSET_SIZE = 5000;
        const VALUE_SIZE = 5000;
        const totalAssets = 0
        CoinSelection.setLoader(S)
        CoinSelection.setProtocolParameters(
            ProtocolParameter.minUtxo.toString(),
            ProtocolParameter.linearFee.minFeeA.toString(),
            ProtocolParameter.linearFee.minFeeB.toString(),
            ProtocolParameter.maxTxSize.toString()
        )

     
      const selection = CoinSelection.randomImprove(
            Utxos,
            Outputs,
            20 + totalAssets,
            ProtocolParameter.minUtxo
        )  
        const inputs = selection.input;
        const txBuilder = S.TransactionBuilder.new(
            S.LinearFee.new(
                S.BigNum.from_str(ProtocolParameter.linearFee.minFeeA),
                S.BigNum.from_str(ProtocolParameter.linearFee.minFeeB)
            ),
            S.BigNum.from_str(ProtocolParameter.minUtxo.toString()),
            S.BigNum.from_str(ProtocolParameter.poolDeposit.toString()),
            S.BigNum.from_str(ProtocolParameter.keyDeposit.toString()),
            MULTIASSET_SIZE,
            MULTIASSET_SIZE
        );

        for (let i = 0; i < inputs.length; i++) {
            const utxo = inputs[i];
            txBuilder.add_input(
              utxo.output().address(),
              utxo.input(),
              utxo.output().amount()
            );
        }

        if(Delegation){
            let certificates = S.Certificates.new();
            if (!Delegation.delegation.active){
                certificates.add(
                    S.Certificate.new_stake_registration(
                        S.StakeRegistration.new(
                            S.StakeCredential.from_keyhash(
                                S.Ed25519KeyHash.from_bytes(
                                    Buffer.from(Delegation.stakeKeyHash, 'hex')
                                )
                            )
                        )
                    )
                )
            }
            
            let poolKeyHash = Delegation.poolHex
            certificates.add(
                S.Certificate.new_stake_delegation(
                  S.StakeDelegation.new(
                    S.StakeCredential.from_keyhash(
                      S.Ed25519KeyHash.from_bytes(
                        Buffer.from(Delegation.stakeKeyHash, 'hex')
                      )
                    ),
                    S.Ed25519KeyHash.from_bytes(
                      Buffer.from(poolKeyHash, 'hex')
                    )
                  )
                )
            );
            txBuilder.set_certs(certificates)
        }


        let AUXILIARY_DATA
        if(Metadata){
            let METADATA = S.GeneralTransactionMetadata.new()
            METADATA.insert(
                S.BigNum.from_str(MetadataLabel),
                S.encode_json_str_to_metadatum(
                    JSON.stringify(Metadata),
                    0
                )
            )
            AUXILIARY_DATA = S.AuxiliaryData.new()
            AUXILIARY_DATA.set_metadata(METADATA)
            //const auxiliaryDataHash = S.hash_auxiliary_data(AUXILIARY_DATA)
            txBuilder.set_auxiliary_data(AUXILIARY_DATA)
        }
        
        for(let i=0; i<Outputs.len(); i++){
            txBuilder.add_output(Outputs.get(i))
        }
        

        const change = selection.change;
        const changeMultiAssets = change.multiasset();
        // check if change value is too big for single output
        if (changeMultiAssets && change.to_bytes().length * 2 > VALUE_SIZE) {
            const partialChange = S.Value.new(
                S.BigNum.from_str('0')
            );
        
            const partialMultiAssets = S.MultiAsset.new();
            const policies = changeMultiAssets.keys();
            const makeSplit = () => {
                for (let j = 0; j < changeMultiAssets.len(); j++) {
                  const policy = policies.get(j);
                  const policyAssets = changeMultiAssets.get(policy);
                  const assetNames = policyAssets.keys();
                  const assets = S.Assets.new();
                  for (let k = 0; k < assetNames.len(); k++) {
                    const policyAsset = assetNames.get(k);
                    const quantity = policyAssets.get(policyAsset);
                    assets.insert(policyAsset, quantity);
                    //check size
                    const checkMultiAssets = S.MultiAsset.from_bytes(
                      partialMultiAssets.to_bytes()
                    );
                    checkMultiAssets.insert(policy, assets);
                    const checkValue = S.Value.new(
                      S.BigNum.from_str('0')
                    );
                    checkValue.set_multiasset(checkMultiAssets);
                    if (
                      checkValue.to_bytes().length * 2 >=
                      VALUE_SIZE
                    ) {
                      partialMultiAssets.insert(policy, assets);
                      return;
                    }
                  }
                  partialMultiAssets.insert(policy, assets);
                }
              };

            makeSplit();
            partialChange.set_multiasset(partialMultiAssets);

            const minAda = S.min_ada_required(
                partialChange,
                S.BigNum.from_str(ProtocolParameter.minUtxo)
            );
            partialChange.set_coin(minAda);

            txBuilder.add_output(
                S.TransactionOutput.new(
                S.Address.from_bech32(PaymentAddress),
                partialChange
                )
            );
        }
        txBuilder.add_change_if_needed(
            S.Address.from_bech32(PaymentAddress)
        );
        const transaction = S.Transaction.new(
            txBuilder.build(),
            S.TransactionWitnessSet.new(),
            AUXILIARY_DATA
        )

        const size = transaction.to_bytes().length * 2;
        if (size > ProtocolParameter.maxTxSize) throw ERROR.TX_TOO_BIG;

        return transaction.to_bytes() 
    }

    

    async function _getProtocolParameter() {
        

        let latestBlock = await _blockfrostRequest("/blocks/latest")
        if(!latestBlock) throw ERROR.FAILED_PROTOCOL_PARAMETER

        let p = await _blockfrostRequest(`/epochs/${latestBlock.epoch}/parameters`) //
        if(!p) throw ERROR.FAILED_PROTOCOL_PARAMETER

        return {
            linearFee: {
              minFeeA: p.min_fee_a.toString(),
              minFeeB: p.min_fee_b.toString(),
            },
            minUtxo: '1000000', //p.min_utxo, minUTxOValue protocol paramter has been removed since Alonzo HF. Calulation of minADA works differently now, but 1 minADA still sufficient for now
            poolDeposit: p.pool_deposit,
            keyDeposit: p.key_deposit,
            maxTxSize: p.max_tx_size, 
            slot: latestBlock.slot,
          };
          
    }
    async function _blockfrostRequest(endpoint ) {
         
        //let networkId = await (await getNetworkId()).id
        let networkId = 0;
       /*  let networkEndpoint = networkId == 0 ? 
            'https://cardano-testnet.blockfrost.io/api/v0' 
            : 
            'https://cardano-mainnet.blockfrost.io/api/v0' */
            let networkEndpoint = 'https://cardano-testnet.blockfrost.io/api/v0';
        try {
            return await (await fetch(`${networkEndpoint}${endpoint}`,{
                headers: {
                    project_id: blockfrostApiKey
                }
            })).json()
          } catch (error) {
            return null
        }
    }


   
    return {
        isEnabled,
        enable,
        getAddress,
        getAddressHex,
        getRewardAddress,
        getRewardAddressHex,
        getNetworkId,
        getUtxos,
        getAssets,
        getUtxosHex,
        send,
        sendMultiple,
        delegate,
        olddelegate,
        auxiliary: {
            Buffer: Buffer,
            AsciiToBuffer: AsciiToBuffer,
            HexToBuffer: HexToBuffer,
            AsciiToHex: AsciiToHex,
            HexToAscii: HexToAscii,
            BufferToAscii: BufferToAscii,
            BufferToHex: BufferToHex,
        }
    }
}




