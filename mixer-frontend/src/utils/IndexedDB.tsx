import { HexString } from '@gear-js/api';
import Dexie from 'dexie';

class MixerDB extends Dexie {
    users: Dexie.Table<IUser, HexString>; 
    transactions: Dexie.Table<ITransaction, number>; 

    constructor() {
        super("MessengerDB");

        this.version(1).stores({
            users: 'addr',
            transactions: '++id, addr'
        });

        this.users = this.table("users");
        this.transactions = this.table("transactions");
    }
}

export interface IUser{
    addr: HexString,
    ss58: string,
    name: string,
}

export interface ITransaction{
    id?: number,
    addr: HexString,
    amount: number,
    time: number,
}

export const db = new MixerDB();

export async function addUser(user: IUser): Promise<HexString> {
    return await db.users.add(user);
}

export async function getUsers(): Promise<IUser[]>{
    return await db.users.toArray()
}

export async function getUserByAddr(addr: HexString): Promise<IUser | undefined>{
    return await db.users.get(addr);
}


export async function addTransactions(transactions: ITransaction[]): Promise<number>{
    return await db.transactions.bulkAdd(transactions);
}

export async function getTransactions(addr: HexString): Promise<ITransaction[]>{
    return await db.transactions.where("addr").equals(addr).toArray();
}