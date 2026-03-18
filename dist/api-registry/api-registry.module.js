"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiRegistryModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const organization_module_1 = require("../organization/organization.module");
const api_registry_controller_1 = require("./api-registry.controller");
const api_registry_service_1 = require("./api-registry.service");
let ApiRegistryModule = class ApiRegistryModule {
};
exports.ApiRegistryModule = ApiRegistryModule;
exports.ApiRegistryModule = ApiRegistryModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, organization_module_1.OrganizationModule],
        controllers: [api_registry_controller_1.ApiRegistryController],
        providers: [api_registry_service_1.ApiRegistryService],
    })
], ApiRegistryModule);
//# sourceMappingURL=api-registry.module.js.map