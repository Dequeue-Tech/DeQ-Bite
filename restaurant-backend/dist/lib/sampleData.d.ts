export declare const sampleCategories: {
    id: string;
    name: string;
    description: string;
    image: string;
    active: boolean;
    sortOrder: number;
}[];
export declare const sampleMenuItems: {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
    categoryId: string;
    category: {
        id: string;
        name: string;
    };
    available: boolean;
    preparationTime: number;
    ingredients: string[];
    allergens: string[];
    isVeg: boolean;
    isVegan: boolean;
    isGlutenFree: boolean;
    spiceLevel: string;
}[];
export declare const sampleTables: {
    id: string;
    number: number;
    capacity: number;
    location: string;
    active: boolean;
}[];
export declare const sampleUsers: ({
    id: string;
    email: string;
    name: string;
    phone: string;
    role: "ADMIN";
    verified: boolean;
    createdAt: string;
    password: string;
} | {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: "CUSTOMER";
    verified: boolean;
    createdAt: string;
    password: string;
})[];
export declare const testCredentials: {
    admin: {
        email: string;
        password: string;
        role: string;
        description: string;
    };
    customer1: {
        email: string;
        password: string;
        role: string;
        description: string;
    };
    customer2: {
        email: string;
        password: string;
        role: string;
        description: string;
    };
};
export declare const sampleOrders: ({
    id: string;
    userId: string;
    tableId: string;
    status: "COMPLETED";
    paymentStatus: "COMPLETED";
    subtotal: number;
    tax: number;
    total: number;
    paymentId: string;
    estimatedTime: number;
    createdAt: string;
    items: {
        id: string;
        menuItemId: string;
        quantity: number;
        price: number;
        menuItem: {
            id: string;
            name: string;
            description: string;
            price: number;
            image: string;
            categoryId: string;
            category: {
                id: string;
                name: string;
            };
            available: boolean;
            preparationTime: number;
            ingredients: string[];
            allergens: string[];
            isVeg: boolean;
            isVegan: boolean;
            isGlutenFree: boolean;
            spiceLevel: string;
        } | undefined;
    }[];
    table: {
        id: string;
        number: number;
        capacity: number;
        location: string;
        active: boolean;
    } | undefined;
    user: {
        id: string;
        email: string;
        name: string;
        phone: string;
        role: "ADMIN";
        verified: boolean;
        createdAt: string;
        password: string;
    } | {
        id: string;
        email: string;
        name: string;
        phone: string;
        role: "CUSTOMER";
        verified: boolean;
        createdAt: string;
        password: string;
    } | undefined;
} | {
    id: string;
    userId: string;
    tableId: string;
    status: "PREPARING";
    paymentStatus: "COMPLETED";
    subtotal: number;
    tax: number;
    total: number;
    paymentId: string;
    estimatedTime: number;
    createdAt: string;
    items: {
        id: string;
        menuItemId: string;
        quantity: number;
        price: number;
        menuItem: {
            id: string;
            name: string;
            description: string;
            price: number;
            image: string;
            categoryId: string;
            category: {
                id: string;
                name: string;
            };
            available: boolean;
            preparationTime: number;
            ingredients: string[];
            allergens: string[];
            isVeg: boolean;
            isVegan: boolean;
            isGlutenFree: boolean;
            spiceLevel: string;
        } | undefined;
    }[];
    table: {
        id: string;
        number: number;
        capacity: number;
        location: string;
        active: boolean;
    } | undefined;
    user: {
        id: string;
        email: string;
        name: string;
        phone: string;
        role: "ADMIN";
        verified: boolean;
        createdAt: string;
        password: string;
    } | {
        id: string;
        email: string;
        name: string;
        phone: string;
        role: "CUSTOMER";
        verified: boolean;
        createdAt: string;
        password: string;
    } | undefined;
})[];
export declare const sampleCategoriesWithItems: {
    menuItems: {
        id: string;
        name: string;
        description: string;
        price: number;
        image: string;
        categoryId: string;
        category: {
            id: string;
            name: string;
        };
        available: boolean;
        preparationTime: number;
        ingredients: string[];
        allergens: string[];
        isVeg: boolean;
        isVegan: boolean;
        isGlutenFree: boolean;
        spiceLevel: string;
    }[];
    id: string;
    name: string;
    description: string;
    image: string;
    active: boolean;
    sortOrder: number;
}[];
export declare const getCategoryById: (id: string) => {
    id: string;
    name: string;
    description: string;
    image: string;
    active: boolean;
    sortOrder: number;
} | undefined;
export declare const getMenuItemById: (id: string) => {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
    categoryId: string;
    category: {
        id: string;
        name: string;
    };
    available: boolean;
    preparationTime: number;
    ingredients: string[];
    allergens: string[];
    isVeg: boolean;
    isVegan: boolean;
    isGlutenFree: boolean;
    spiceLevel: string;
} | undefined;
export declare const getTableById: (id: string) => {
    id: string;
    number: number;
    capacity: number;
    location: string;
    active: boolean;
} | undefined;
export declare const getUserById: (id: string) => {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: "ADMIN";
    verified: boolean;
    createdAt: string;
    password: string;
} | {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: "CUSTOMER";
    verified: boolean;
    createdAt: string;
    password: string;
} | undefined;
export declare const getMenuItemsByCategory: (categoryId: string) => {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
    categoryId: string;
    category: {
        id: string;
        name: string;
    };
    available: boolean;
    preparationTime: number;
    ingredients: string[];
    allergens: string[];
    isVeg: boolean;
    isVegan: boolean;
    isGlutenFree: boolean;
    spiceLevel: string;
}[];
export declare const getVegetarianItems: () => {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
    categoryId: string;
    category: {
        id: string;
        name: string;
    };
    available: boolean;
    preparationTime: number;
    ingredients: string[];
    allergens: string[];
    isVeg: boolean;
    isVegan: boolean;
    isGlutenFree: boolean;
    spiceLevel: string;
}[];
export declare const getVeganItems: () => {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
    categoryId: string;
    category: {
        id: string;
        name: string;
    };
    available: boolean;
    preparationTime: number;
    ingredients: string[];
    allergens: string[];
    isVeg: boolean;
    isVegan: boolean;
    isGlutenFree: boolean;
    spiceLevel: string;
}[];
export declare const getGlutenFreeItems: () => {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
    categoryId: string;
    category: {
        id: string;
        name: string;
    };
    available: boolean;
    preparationTime: number;
    ingredients: string[];
    allergens: string[];
    isVeg: boolean;
    isVegan: boolean;
    isGlutenFree: boolean;
    spiceLevel: string;
}[];
export declare const getItemsBySpiceLevel: (spiceLevel: string) => {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
    categoryId: string;
    category: {
        id: string;
        name: string;
    };
    available: boolean;
    preparationTime: number;
    ingredients: string[];
    allergens: string[];
    isVeg: boolean;
    isVegan: boolean;
    isGlutenFree: boolean;
    spiceLevel: string;
}[];
export declare const getAvailableTables: () => {
    id: string;
    number: number;
    capacity: number;
    location: string;
    active: boolean;
}[];
export declare const getTablesByCapacity: (minCapacity: number) => {
    id: string;
    number: number;
    capacity: number;
    location: string;
    active: boolean;
}[];
export declare const mockApiResponse: {
    categories: {
        menuItems: {
            id: string;
            name: string;
            description: string;
            price: number;
            image: string;
            categoryId: string;
            category: {
                id: string;
                name: string;
            };
            available: boolean;
            preparationTime: number;
            ingredients: string[];
            allergens: string[];
            isVeg: boolean;
            isVegan: boolean;
            isGlutenFree: boolean;
            spiceLevel: string;
        }[];
        id: string;
        name: string;
        description: string;
        image: string;
        active: boolean;
        sortOrder: number;
    }[];
    menuItems: {
        id: string;
        name: string;
        description: string;
        price: number;
        image: string;
        categoryId: string;
        category: {
            id: string;
            name: string;
        };
        available: boolean;
        preparationTime: number;
        ingredients: string[];
        allergens: string[];
        isVeg: boolean;
        isVegan: boolean;
        isGlutenFree: boolean;
        spiceLevel: string;
    }[];
    tables: {
        id: string;
        number: number;
        capacity: number;
        location: string;
        active: boolean;
    }[];
    users: ({
        id: string;
        email: string;
        name: string;
        phone: string;
        role: "ADMIN";
        verified: boolean;
        createdAt: string;
        password: string;
    } | {
        id: string;
        email: string;
        name: string;
        phone: string;
        role: "CUSTOMER";
        verified: boolean;
        createdAt: string;
        password: string;
    })[];
    orders: ({
        id: string;
        userId: string;
        tableId: string;
        status: "COMPLETED";
        paymentStatus: "COMPLETED";
        subtotal: number;
        tax: number;
        total: number;
        paymentId: string;
        estimatedTime: number;
        createdAt: string;
        items: {
            id: string;
            menuItemId: string;
            quantity: number;
            price: number;
            menuItem: {
                id: string;
                name: string;
                description: string;
                price: number;
                image: string;
                categoryId: string;
                category: {
                    id: string;
                    name: string;
                };
                available: boolean;
                preparationTime: number;
                ingredients: string[];
                allergens: string[];
                isVeg: boolean;
                isVegan: boolean;
                isGlutenFree: boolean;
                spiceLevel: string;
            } | undefined;
        }[];
        table: {
            id: string;
            number: number;
            capacity: number;
            location: string;
            active: boolean;
        } | undefined;
        user: {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "ADMIN";
            verified: boolean;
            createdAt: string;
            password: string;
        } | {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "CUSTOMER";
            verified: boolean;
            createdAt: string;
            password: string;
        } | undefined;
    } | {
        id: string;
        userId: string;
        tableId: string;
        status: "PREPARING";
        paymentStatus: "COMPLETED";
        subtotal: number;
        tax: number;
        total: number;
        paymentId: string;
        estimatedTime: number;
        createdAt: string;
        items: {
            id: string;
            menuItemId: string;
            quantity: number;
            price: number;
            menuItem: {
                id: string;
                name: string;
                description: string;
                price: number;
                image: string;
                categoryId: string;
                category: {
                    id: string;
                    name: string;
                };
                available: boolean;
                preparationTime: number;
                ingredients: string[];
                allergens: string[];
                isVeg: boolean;
                isVegan: boolean;
                isGlutenFree: boolean;
                spiceLevel: string;
            } | undefined;
        }[];
        table: {
            id: string;
            number: number;
            capacity: number;
            location: string;
            active: boolean;
        } | undefined;
        user: {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "ADMIN";
            verified: boolean;
            createdAt: string;
            password: string;
        } | {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "CUSTOMER";
            verified: boolean;
            createdAt: string;
            password: string;
        } | undefined;
    })[];
};
declare const _default: {
    categories: {
        id: string;
        name: string;
        description: string;
        image: string;
        active: boolean;
        sortOrder: number;
    }[];
    menuItems: {
        id: string;
        name: string;
        description: string;
        price: number;
        image: string;
        categoryId: string;
        category: {
            id: string;
            name: string;
        };
        available: boolean;
        preparationTime: number;
        ingredients: string[];
        allergens: string[];
        isVeg: boolean;
        isVegan: boolean;
        isGlutenFree: boolean;
        spiceLevel: string;
    }[];
    tables: {
        id: string;
        number: number;
        capacity: number;
        location: string;
        active: boolean;
    }[];
    users: ({
        id: string;
        email: string;
        name: string;
        phone: string;
        role: "ADMIN";
        verified: boolean;
        createdAt: string;
        password: string;
    } | {
        id: string;
        email: string;
        name: string;
        phone: string;
        role: "CUSTOMER";
        verified: boolean;
        createdAt: string;
        password: string;
    })[];
    orders: ({
        id: string;
        userId: string;
        tableId: string;
        status: "COMPLETED";
        paymentStatus: "COMPLETED";
        subtotal: number;
        tax: number;
        total: number;
        paymentId: string;
        estimatedTime: number;
        createdAt: string;
        items: {
            id: string;
            menuItemId: string;
            quantity: number;
            price: number;
            menuItem: {
                id: string;
                name: string;
                description: string;
                price: number;
                image: string;
                categoryId: string;
                category: {
                    id: string;
                    name: string;
                };
                available: boolean;
                preparationTime: number;
                ingredients: string[];
                allergens: string[];
                isVeg: boolean;
                isVegan: boolean;
                isGlutenFree: boolean;
                spiceLevel: string;
            } | undefined;
        }[];
        table: {
            id: string;
            number: number;
            capacity: number;
            location: string;
            active: boolean;
        } | undefined;
        user: {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "ADMIN";
            verified: boolean;
            createdAt: string;
            password: string;
        } | {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "CUSTOMER";
            verified: boolean;
            createdAt: string;
            password: string;
        } | undefined;
    } | {
        id: string;
        userId: string;
        tableId: string;
        status: "PREPARING";
        paymentStatus: "COMPLETED";
        subtotal: number;
        tax: number;
        total: number;
        paymentId: string;
        estimatedTime: number;
        createdAt: string;
        items: {
            id: string;
            menuItemId: string;
            quantity: number;
            price: number;
            menuItem: {
                id: string;
                name: string;
                description: string;
                price: number;
                image: string;
                categoryId: string;
                category: {
                    id: string;
                    name: string;
                };
                available: boolean;
                preparationTime: number;
                ingredients: string[];
                allergens: string[];
                isVeg: boolean;
                isVegan: boolean;
                isGlutenFree: boolean;
                spiceLevel: string;
            } | undefined;
        }[];
        table: {
            id: string;
            number: number;
            capacity: number;
            location: string;
            active: boolean;
        } | undefined;
        user: {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "ADMIN";
            verified: boolean;
            createdAt: string;
            password: string;
        } | {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "CUSTOMER";
            verified: boolean;
            createdAt: string;
            password: string;
        } | undefined;
    })[];
    categoriesWithItems: {
        menuItems: {
            id: string;
            name: string;
            description: string;
            price: number;
            image: string;
            categoryId: string;
            category: {
                id: string;
                name: string;
            };
            available: boolean;
            preparationTime: number;
            ingredients: string[];
            allergens: string[];
            isVeg: boolean;
            isVegan: boolean;
            isGlutenFree: boolean;
            spiceLevel: string;
        }[];
        id: string;
        name: string;
        description: string;
        image: string;
        active: boolean;
        sortOrder: number;
    }[];
    helpers: {
        getCategoryById: (id: string) => {
            id: string;
            name: string;
            description: string;
            image: string;
            active: boolean;
            sortOrder: number;
        } | undefined;
        getMenuItemById: (id: string) => {
            id: string;
            name: string;
            description: string;
            price: number;
            image: string;
            categoryId: string;
            category: {
                id: string;
                name: string;
            };
            available: boolean;
            preparationTime: number;
            ingredients: string[];
            allergens: string[];
            isVeg: boolean;
            isVegan: boolean;
            isGlutenFree: boolean;
            spiceLevel: string;
        } | undefined;
        getTableById: (id: string) => {
            id: string;
            number: number;
            capacity: number;
            location: string;
            active: boolean;
        } | undefined;
        getUserById: (id: string) => {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "ADMIN";
            verified: boolean;
            createdAt: string;
            password: string;
        } | {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "CUSTOMER";
            verified: boolean;
            createdAt: string;
            password: string;
        } | undefined;
        getMenuItemsByCategory: (categoryId: string) => {
            id: string;
            name: string;
            description: string;
            price: number;
            image: string;
            categoryId: string;
            category: {
                id: string;
                name: string;
            };
            available: boolean;
            preparationTime: number;
            ingredients: string[];
            allergens: string[];
            isVeg: boolean;
            isVegan: boolean;
            isGlutenFree: boolean;
            spiceLevel: string;
        }[];
        getVegetarianItems: () => {
            id: string;
            name: string;
            description: string;
            price: number;
            image: string;
            categoryId: string;
            category: {
                id: string;
                name: string;
            };
            available: boolean;
            preparationTime: number;
            ingredients: string[];
            allergens: string[];
            isVeg: boolean;
            isVegan: boolean;
            isGlutenFree: boolean;
            spiceLevel: string;
        }[];
        getVeganItems: () => {
            id: string;
            name: string;
            description: string;
            price: number;
            image: string;
            categoryId: string;
            category: {
                id: string;
                name: string;
            };
            available: boolean;
            preparationTime: number;
            ingredients: string[];
            allergens: string[];
            isVeg: boolean;
            isVegan: boolean;
            isGlutenFree: boolean;
            spiceLevel: string;
        }[];
        getGlutenFreeItems: () => {
            id: string;
            name: string;
            description: string;
            price: number;
            image: string;
            categoryId: string;
            category: {
                id: string;
                name: string;
            };
            available: boolean;
            preparationTime: number;
            ingredients: string[];
            allergens: string[];
            isVeg: boolean;
            isVegan: boolean;
            isGlutenFree: boolean;
            spiceLevel: string;
        }[];
        getItemsBySpiceLevel: (spiceLevel: string) => {
            id: string;
            name: string;
            description: string;
            price: number;
            image: string;
            categoryId: string;
            category: {
                id: string;
                name: string;
            };
            available: boolean;
            preparationTime: number;
            ingredients: string[];
            allergens: string[];
            isVeg: boolean;
            isVegan: boolean;
            isGlutenFree: boolean;
            spiceLevel: string;
        }[];
        getAvailableTables: () => {
            id: string;
            number: number;
            capacity: number;
            location: string;
            active: boolean;
        }[];
        getTablesByCapacity: (minCapacity: number) => {
            id: string;
            number: number;
            capacity: number;
            location: string;
            active: boolean;
        }[];
    };
    mockApiResponse: {
        categories: {
            menuItems: {
                id: string;
                name: string;
                description: string;
                price: number;
                image: string;
                categoryId: string;
                category: {
                    id: string;
                    name: string;
                };
                available: boolean;
                preparationTime: number;
                ingredients: string[];
                allergens: string[];
                isVeg: boolean;
                isVegan: boolean;
                isGlutenFree: boolean;
                spiceLevel: string;
            }[];
            id: string;
            name: string;
            description: string;
            image: string;
            active: boolean;
            sortOrder: number;
        }[];
        menuItems: {
            id: string;
            name: string;
            description: string;
            price: number;
            image: string;
            categoryId: string;
            category: {
                id: string;
                name: string;
            };
            available: boolean;
            preparationTime: number;
            ingredients: string[];
            allergens: string[];
            isVeg: boolean;
            isVegan: boolean;
            isGlutenFree: boolean;
            spiceLevel: string;
        }[];
        tables: {
            id: string;
            number: number;
            capacity: number;
            location: string;
            active: boolean;
        }[];
        users: ({
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "ADMIN";
            verified: boolean;
            createdAt: string;
            password: string;
        } | {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: "CUSTOMER";
            verified: boolean;
            createdAt: string;
            password: string;
        })[];
        orders: ({
            id: string;
            userId: string;
            tableId: string;
            status: "COMPLETED";
            paymentStatus: "COMPLETED";
            subtotal: number;
            tax: number;
            total: number;
            paymentId: string;
            estimatedTime: number;
            createdAt: string;
            items: {
                id: string;
                menuItemId: string;
                quantity: number;
                price: number;
                menuItem: {
                    id: string;
                    name: string;
                    description: string;
                    price: number;
                    image: string;
                    categoryId: string;
                    category: {
                        id: string;
                        name: string;
                    };
                    available: boolean;
                    preparationTime: number;
                    ingredients: string[];
                    allergens: string[];
                    isVeg: boolean;
                    isVegan: boolean;
                    isGlutenFree: boolean;
                    spiceLevel: string;
                } | undefined;
            }[];
            table: {
                id: string;
                number: number;
                capacity: number;
                location: string;
                active: boolean;
            } | undefined;
            user: {
                id: string;
                email: string;
                name: string;
                phone: string;
                role: "ADMIN";
                verified: boolean;
                createdAt: string;
                password: string;
            } | {
                id: string;
                email: string;
                name: string;
                phone: string;
                role: "CUSTOMER";
                verified: boolean;
                createdAt: string;
                password: string;
            } | undefined;
        } | {
            id: string;
            userId: string;
            tableId: string;
            status: "PREPARING";
            paymentStatus: "COMPLETED";
            subtotal: number;
            tax: number;
            total: number;
            paymentId: string;
            estimatedTime: number;
            createdAt: string;
            items: {
                id: string;
                menuItemId: string;
                quantity: number;
                price: number;
                menuItem: {
                    id: string;
                    name: string;
                    description: string;
                    price: number;
                    image: string;
                    categoryId: string;
                    category: {
                        id: string;
                        name: string;
                    };
                    available: boolean;
                    preparationTime: number;
                    ingredients: string[];
                    allergens: string[];
                    isVeg: boolean;
                    isVegan: boolean;
                    isGlutenFree: boolean;
                    spiceLevel: string;
                } | undefined;
            }[];
            table: {
                id: string;
                number: number;
                capacity: number;
                location: string;
                active: boolean;
            } | undefined;
            user: {
                id: string;
                email: string;
                name: string;
                phone: string;
                role: "ADMIN";
                verified: boolean;
                createdAt: string;
                password: string;
            } | {
                id: string;
                email: string;
                name: string;
                phone: string;
                role: "CUSTOMER";
                verified: boolean;
                createdAt: string;
                password: string;
            } | undefined;
        })[];
    };
};
export default _default;
//# sourceMappingURL=sampleData.d.ts.map