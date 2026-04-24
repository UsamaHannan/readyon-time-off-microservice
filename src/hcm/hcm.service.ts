import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AxiosError } from 'axios';

@Injectable()
export class HcmService {
  private readonly logger = new Logger(HcmService.name);
  // In a real app, this comes from ConfigService
  private readonly hcmBaseUrl =
    process.env.HCM_API_URL || 'http://localhost:3001/api/hcm';

  constructor(private readonly httpService: HttpService) {}

  async getBalance(
    employeeId: string,
    locationId: string,
  ): Promise<number | null> {
    try {
      this.logger.log(
        `Fetching balance from HCM for ${employeeId} at ${locationId}`,
      );
      const { data } = await firstValueFrom(
        this.httpService
          .get(`${this.hcmBaseUrl}/balances/${employeeId}/${locationId}`)
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error(
                `HCM API error on getBalance: ${error.message}`,
              );
              throw error;
            }),
          ),
      );
      return data.balance;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      // Re-throw or handle based on resilience strategy
      throw new HttpException(
        'Failed to fetch balance from HCM',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async submitTimeOff(payload: {
    employeeId: string;
    locationId: string;
    days: number;
    type: string;
    startDate: string;
    endDate: string;
  }): Promise<{ success: boolean; hcmReferenceId?: string; error?: string }> {
    try {
      this.logger.log(`Submitting time off to HCM for ${payload.employeeId}`);
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.hcmBaseUrl}/time-off`, payload).pipe(
          catchError((error: AxiosError) => {
            if (error.response?.status === 400) {
              // Return the error so the caller can decide to mark as HCM_REJECTED
              return [
                {
                  data: {
                    success: false,
                    error: (error.response.data as any).error,
                  },
                },
              ];
            }
            this.logger.error(
              `HCM API error on submitTimeOff: ${error.message}`,
            );
            throw error;
          }),
        ),
      );

      // If the catchError returned an array, it's a 400 rejection from HCM
      if (Array.isArray(data)) {
        return data[0].data;
      }

      return {
        success: true,
        hcmReferenceId: data.hcmReferenceId,
      };
    } catch {
      throw new HttpException(
        'Failed to submit time off to HCM',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getBatchBalances(): Promise<
    Array<{ employeeId: string; locationId: string; balance: number }>
  > {
    try {
      this.logger.log(`Fetching batch balances from HCM`);
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.hcmBaseUrl}/balances/batch`).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(
              `HCM API error on getBatchBalances: ${error.message}`,
            );
            throw error;
          }),
        ),
      );
      return data;
    } catch {
      throw new HttpException(
        'Failed to fetch batch balances from HCM',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
