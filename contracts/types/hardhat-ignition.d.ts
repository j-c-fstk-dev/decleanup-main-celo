declare module "@nomicfoundation/hardhat-ignition" {
    export function buildModule(
      name: string,
      builder: (m: any) => any
    ): any;
  
    export interface ModuleBuilder {
      contract(
        name: string,
        args?: any[]
      ): any;
  
      call(
        contract: any,
        method: string,
        args?: any[]
      ): any;
  
      keccak256(input: string): string;
    }
  }
  
  declare module "@nomicfoundation/hardhat-ignition/modules" {
    import { ModuleBuilder } from "@nomicfoundation/hardhat-ignition";
  
    export function buildModule(
      name: string,
      builder: (m: ModuleBuilder) => any
    ): any;
  
    export { ModuleBuilder };
  }
  